# Argo — Implementation Blueprint

> **Mục tiêu:** Hoàn thiện 4 trụ cột còn thiếu: Memory Brain wiring, OMNI UI/UX integration, Automation layer, và Dokploy self-hosting.  
> **Nguyên tắc:** Không phá vỡ gì đang chạy. Mỗi phase độc lập, có thể deploy riêng.

---

## Tổng quan kiến trúc hiện tại

```
┌─────────────────────────────────────────────────────────────┐
│                     Tauri 2 Desktop                          │
│  TitleBar │ NavRail (7 tabs) │ StatusBar (ModelSelector)     │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP / SSE
┌─────────────────────▼───────────────────────────────────────┐
│              FastAPI Backend (port 8001)                      │
│                                                               │
│  chat.py ──► ClaudeCliService ──► Claude CLI subprocess      │
│     │              │                    │                     │
│     │         MCP inject           argomemory MCP (if set)   │
│     │                                                         │
│  memory_svc ──► argomemory REST (port 3111)                  │
│     │           recall_context() / save_insight()            │
│     │                                                         │
│  runner.py ──► Planner → Engineer → CostEstimator → Writer   │
│     │           (RAG inject via _get_rag_context)             │
│     │                                                         │
│  Chiron ──► pgvector HNSW ──► Ollama nomic-embed-text        │
│             MinIO storage                                     │
└─────────────────────────────────────────────────────────────┘
         │              │              │
    PostgreSQL        Redis         Celery worker
```

---

## Phase 1 — Memory Brain: Hoàn thiện các gaps

### 1A. Audit: Memory hiện đang hoạt động ở đâu?

| Điểm | Wired? | Ghi chú |
|------|--------|---------|
| `chat.py` → recall trước session mới | ✅ | `memory_svc.recall_context()` tại line 209 |
| `chat.py` → save sau session kết thúc | ✅ | `_save_session_memory()` fire-and-forget |
| Claude CLI subprocess | ✅ (partial) | `ARGOMEMORY_MCP_PATH` inject MCP, nhưng cần set env var |
| Tier 0 (Chiron RAG + workspace) | ✅ | `build_context_injection()` |
| Tier 1 (change_log 3 entries) | ✅ | `_get_tier1_context()` |
| Pipeline agents (Planner/Engineer/Writer) | ❌ | Không recall/save memory |
| Chiron ingest flow | ❌ | Không save lesson sau khi tìm kiếm |
| Worker tasks (arq) | ❌ | Không dùng memory |
| `memory_smart_search` | ❌ | Tool tốt hơn `memory_recall`, chưa dùng |
| `memory_reflect` | ❌ | Post-session reflection chưa wired |
| `memory_lesson_save` | ❌ | Chưa dùng |

### 1B. Những tools argomemory chưa được dùng

Argomemory có 8 tools, Argo chỉ dùng 2:

| Tool | Đang dùng? | Nên dùng ở đâu |
|------|-----------|----------------|
| `memory_recall` | ✅ | chat.py |
| `memory_save` | ✅ | chat.py |
| `memory_smart_search` | ❌ | Thay thế `memory_recall` — kết quả tốt hơn |
| `memory_sessions` | ❌ | Health check, debug panel |
| `memory_lesson_save` | ❌ | Sau pipeline complete |
| `memory_reflect` | ❌ | End-of-session summary |
| `memory_consolidate` | ❌ | Scheduled task hàng đêm |
| `memory_diagnose` | ❌ | Admin/debug route |

### 1C. Fix gaps — implementation

**Fix 1: Nâng `memory_recall` → `memory_smart_search`**

```python
# backend/app/services/memory_svc.py
async def recall_context(self, query: str, token_budget: int = 600) -> str | None:
    result = await self._call_tool(
        "memory_smart_search",  # ← đổi từ memory_recall
        {"query": query, "limit": 5, "token_budget": token_budget},
    )
```

**Fix 2: Wire memory vào Pipeline runner**

```python
# backend/app/agents/pipeline/runner.py — trong run_pipeline()

# Thêm sau bước token compression (trước Planner):
if settings.ARGOMEMORY_ENABLED:
    from app.services.memory_svc import memory_svc
    memory_context = await memory_svc.recall_context(description, token_budget=400)
    if memory_context:
        enriched = f"{memory_context}\n\n{enriched}"

# Thêm sau bước complete (sau Writer):
if settings.ARGOMEMORY_ENABLED:
    from app.services.memory_svc import memory_svc
    await memory_svc.save_insight(
        content=f"Pipeline ran for: {description[:300]}\nSpec summary: {spec[:500]}",
        memory_type="fact",
        concepts=description.split()[:8],
    )
```

**Fix 3: Post-session reflection**

```python
# backend/app/api/routes/v1/chat.py — trong _save_session_memory()
async def _save_session_memory(user_message: str, assistant_chunks: list[str]) -> None:
    assistant_reply = "".join(assistant_chunks)
    # Bước 1: save fact như cũ
    summary = f"User asked: {user_message[:300]}\nClaude replied: {assistant_reply[:500]}"
    await memory_svc.save_insight(content=summary, memory_type="fact",
                                   concepts=_extract_concepts(user_message))
    # Bước 2: reflect (non-blocking)
    await memory_svc._call_tool("memory_reflect", {
        "session_summary": summary,
        "extract_lessons": True,
    })
```

**Fix 4: Scheduled memory consolidation (Celery Beat)**

```python
# backend/app/worker/tasks/memory_tasks.py
from app.services.memory_svc import memory_svc

async def consolidate_memory():
    """Runs nightly — merges duplicate memories, prunes low-value entries."""
    await memory_svc._call_tool("memory_consolidate", {"dry_run": False})
```

**Fix 5: Đảm bảo ARGOMEMORY_MCP_PATH được set**

```bash
# backend/.env
ARGOMEMORY_MCP_PATH=/path/to/argomemory/dist/standalone.mjs
ARGOMEMORY_URL=http://localhost:3111
ARGOMEMORY_ENABLED=true
```

Khi `ARGOMEMORY_MCP_PATH` được set, mỗi Claude CLI subprocess nhận argomemory MCP
natively — Claude có thể tự gọi `memory_recall`, `memory_save` trong conversation.

### 1D. So sánh với argomemory (Claude Code's memory)

| Tính năng | argomemory (Claude Code) | Argo Memory (hiện tại) | Gap |
|-----------|--------------------------|------------------------|-----|
| Recall trước task | ✅ auto | ✅ chat only | Pipeline không có |
| Save sau task | ✅ auto | ✅ chat only | Pipeline không có |
| Smart search | ✅ | ❌ | Đổi sang `memory_smart_search` |
| Reflection | ✅ | ❌ | Thêm vào `_save_session_memory` |
| Lessons | ✅ | ❌ | Thêm sau pipeline |
| Consolidation | ✅ scheduled | ❌ | Celery Beat task |
| CLI native access | ✅ | ✅ (nếu MCP_PATH set) | Cần set env var |
| Cross-session | ✅ | ✅ (REST) | OK |

**Kết luận:** Argo's memory architecture đúng hướng nhưng chưa fully wired. Cần 5 fixes nhỏ ở trên — tất cả additive, không breaking.

---

## Phase 2 — OMNI UI/UX Integration với Argo Agents

### 2A. Kiến trúc integration

```
OMNI MCP Server (Python FastMCP)
  omni-skills/*.md → BM25 search → merged skill guidance
  omni-brands/     → brand tokens
        │
        │  Short term: HTTP wrapper
        ▼
┌──────────────────────────────────┐
│   OMNI FastAPI adapter           │
│   POST /omni/generate            │
│   POST /omni/brand               │
│   GET  /omni/health              │
└──────────────┬───────────────────┘
               │ httpx (async)
               ▼
    Engineer Agent (pipeline)
    khi task_type == "ui" | "frontend" | "design"
        │
        ▼ inject vào system_prompt
    merged skill guidance (~2000 tokens)
```

**Dài hạn (Chiron RAG approach — zero agent code change):**

```
omni-skills/*.md ──► one-time ingest ──► Chiron workspace "design-system"
                                               │
                                    pgvector HNSW (768d)
                                               │
                              _get_rag_context() trong runner.py
                                               │
                              auto-inject vào tất cả agents
```

### 2B. Implementation ngắn hạn — OMNI HTTP adapter

```python
# omni-mcp/adapter.py — thin FastAPI wrapper
from fastapi import FastAPI
from pydantic import BaseModel
# Import trực tiếp logic từ server.py
from server import _bm25_search, _load_skills, SKILL_MAP

app = FastAPI()

class GenerateRequest(BaseModel):
    task: str
    stack: str = "React + TypeScript"
    style_direction: str | None = None
    brand_reference: str | None = None
    max_skills: int = 4

@app.post("/omni/generate")
async def generate(req: GenerateRequest):
    # Gọi logic hiện có của OMNI
    result = _omni_generate(req.task, req.stack, req.style_direction,
                             req.brand_reference, req.max_skills)
    return result

@app.get("/omni/health")
async def health():
    return {"ok": True, "skills": len(SKILL_MAP)}
```

```python
# backend/app/services/omni_svc.py
import httpx
from app.core.config import settings

class OmniService:
    async def get_ui_guidance(self, task: str, style: str | None = None) -> str | None:
        if not settings.OMNI_URL:
            return None
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.post(f"{settings.OMNI_URL}/omni/generate",
                                      json={"task": task, "style_direction": style})
                if r.is_success:
                    return r.json().get("implementation_prompt")
        except Exception:
            return None

omni_svc = OmniService()
```

```python
# backend/app/agents/pipeline/engineer.py — inject OMNI guidance
from app.services.omni_svc import omni_svc

async def run_engineer(description: str, plan: PlannerOutput) -> ArchitectureOutput:
    # Detect nếu task liên quan đến UI
    ui_keywords = {"ui", "frontend", "design", "component", "dashboard", "interface"}
    is_ui_task = any(kw in description.lower() for kw in ui_keywords)

    extra_context = ""
    if is_ui_task:
        guidance = await omni_svc.get_ui_guidance(description)
        if guidance:
            extra_context = f"\n\n## UI/UX Design Guidance\n{guidance[:2000]}"

    model, _ = await get_model_for_agent("engineer")
    agent = Agent[None, ArchitectureOutput](
        model=model,
        system_prompt=ENGINEER_SYSTEM_PROMPT + extra_context,  # inject
        output_type=ArchitectureOutput,
    )
```

### 2C. Implementation dài hạn — Chiron ingest

```bash
# Script một lần — ingest tất cả OMNI skills vào workspace "design-system"
python scripts/ingest_omni_skills.py \
  --skills-dir /path/to/OMNI-UI-UX/omni-skills \
  --workspace-id <design-system-workspace-id>
```

Sau đó `_get_rag_context()` trong `runner.py` tự động kéo UI guidance khi relevant — không cần sửa agents.

### 2C. Config cần thêm

```bash
# backend/.env
OMNI_URL=http://localhost:8090  # OMNI adapter port
```

```python
# backend/app/core/config.py
OMNI_URL: str = ""  # empty = disabled
```

---

## Phase 3 — Automation Layer

### 3A. Mức độ phức tạp

| Tính năng | Effort | Blocking dependencies |
|-----------|--------|----------------------|
| Celery Beat (scheduled tasks) | 4 giờ | Celery đã có sẵn |
| Webhook endpoint (GitHub/n8n) | 1 ngày | Không |
| n8n integration (external) | 0 (zero code) | n8n deployed |
| Memory consolidation schedule | 2 giờ | Phase 1 done |

### 3B. Celery Beat config

```python
# backend/app/worker/celery_app.py
from celery.schedules import crontab

app.conf.beat_schedule = {
    # Chiron re-index hàng đêm lúc 2am
    "chiron-reindex-nightly": {
        "task": "app.worker.tasks.chiron_tasks.reindex_all_workspaces",
        "schedule": crontab(hour=2, minute=0),
    },
    # Memory consolidation hàng đêm lúc 3am
    "memory-consolidate-nightly": {
        "task": "app.worker.tasks.memory_tasks.consolidate_memory",
        "schedule": crontab(hour=3, minute=0),
    },
    # Provider health probe mỗi 60s
    "provider-health-probe": {
        "task": "app.worker.tasks.provider_tasks.probe_all_providers",
        "schedule": 60.0,
    },
}
```

### 3C. Webhook endpoint

```python
# backend/app/api/routes/v1/webhooks.py
import hmac, hashlib
from fastapi import APIRouter, BackgroundTasks, Header, Request

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

@router.post("/github")
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_github_event: str = Header(default="push"),
    x_hub_signature_256: str = Header(default=""),
):
    body = await request.body()
    # Verify signature
    expected = "sha256=" + hmac.new(
        settings.GITHUB_WEBHOOK_SECRET.encode(),
        body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, x_hub_signature_256):
        raise HTTPException(status_code=401)

    payload = await request.json()
    if x_github_event == "push":
        commit_msg = payload.get("head_commit", {}).get("message", "")
        background_tasks.add_task(
            run_pipeline_background, commit_msg
        )
    return {"status": "queued"}

async def run_pipeline_background(description: str):
    async for _ in run_pipeline(description):
        pass  # consume generator, result saved to DB
```

### 3D. n8n integration (zero code change)

n8n có thể gọi Argo API trực tiếp:

```
n8n workflow:
  Trigger: GitHub push / Cron / Slack command
      │
      ▼
  HTTP Request node:
    POST http://argo-backend/api/v1/pipeline/run
    Body: {"description": "{{$json.commit.message}}"}
      │
      ▼
  Slack node: gửi spec kết quả
```

Deploy n8n trên cùng VPS với Dokploy, thêm vào `docker-compose.yml`:

```yaml
n8n:
  image: n8nio/n8n
  ports:
    - "5678:5678"
  environment:
    - N8N_BASIC_AUTH_ACTIVE=true
    - N8N_BASIC_AUTH_USER=admin
    - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
  volumes:
    - n8n_data:/home/node/.n8n
```

---

## Phase 4 — Dokploy Self-hosting

### 4A. Stack mapping

| Service Argo | Dokploy deploy method | Notes |
|-------------|----------------------|-------|
| FastAPI backend | Docker app (Dockerfile) | Port 8001 |
| PostgreSQL | Built-in DB + `pgvector/pgvector:pg16` image | Cần custom image |
| Redis | Built-in DB | |
| Celery worker | Docker app (same image, different command) | `celery -A app.worker.celery_app worker` |
| Celery Beat | Docker app (same image) | `celery -A app.worker.celery_app beat` |
| MinIO | Docker Compose / Template | Port 9000/9001 |
| n8n | Docker app | Port 5678 |
| OMNI adapter | Docker app | Port 8090 |
| argomemory | Docker app (Node.js) | Port 3111 |
| Tauri binary | GitHub Releases CI | Không host, user download |

### 4B. Docker Compose cho Dokploy

```yaml
# docker-compose.prod.yml — deploy qua Dokploy Compose feature
version: "3.9"

services:
  backend:
    image: ghcr.io/yourorg/argo-backend:latest
    environment:
      - POSTGRES_HOST=db
      - REDIS_HOST=redis
      - ARGOMEMORY_URL=http://argomemory:3111
      - OMNI_URL=http://omni:8090
      - OLLAMA_HOST=${OLLAMA_HOST}  # local machine qua Cloudflare Tunnel
    depends_on: [db, redis, argomemory]
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.argo.rule=Host(`api.argo.yourdomain.com`)"
      - "traefik.http.routers.argo.tls.certresolver=letsencrypt"

  db:
    image: pgvector/pgvector:pg16  # ← giải quyết pgvector limitation
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

  celery_worker:
    image: ghcr.io/yourorg/argo-backend:latest
    command: celery -A app.worker.celery_app worker -l info
    depends_on: [db, redis]

  celery_beat:
    image: ghcr.io/yourorg/argo-backend:latest
    command: celery -A app.worker.celery_app beat -l info
    depends_on: [db, redis]

  argomemory:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - argomemory_data:/app/data
    command: node dist/standalone.mjs
    environment:
      - ARGOMEMORY_DATA_DIR=/app/data
      - PORT=3111

  omni:
    build:
      context: ../OMNI-UI-UX/omni-mcp
      dockerfile: Dockerfile
    environment:
      - OMNI_SKILLS_DIR=/app/omni-skills
    volumes:
      - ../OMNI-UI-UX/omni-skills:/app/omni-skills:ro

  n8n:
    image: n8nio/n8n
    volumes:
      - n8n_data:/home/node/.n8n
    labels:
      - "traefik.http.routers.n8n.rule=Host(`n8n.yourdomain.com`)"

volumes:
  postgres_data:
  argomemory_data:
  n8n_data:
```

### 4C. Giải quyết 3 limitations

**Limitation 1: Tauri desktop không host được**

```yaml
# .github/workflows/release.yml
name: Release Tauri App
on:
  push:
    tags: ['v*']
jobs:
  build:
    strategy:
      matrix:
        os: [macos-latest, ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: tauri-apps/tauri-action@v0
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'Argo ${{ github.ref_name }}'
```

User download binary từ GitHub Releases. Frontend connect đến backend URL được config trong app settings.

**Limitation 2: Ollama GPU trên VPS**

Hybrid approach — Ollama chạy local, expose qua Cloudflare Tunnel:

```bash
# Trên máy local (Apple Silicon / CUDA GPU)
cloudflared tunnel --url http://localhost:11434 --name argo-ollama
# → nhận URL: https://xxxx.trycloudflare.com

# Trên VPS (trong Dokploy env vars)
OLLAMA_HOST=https://xxxx.trycloudflare.com
ROUTING_MODE=auto  # fallback sang Anthropic API khi tunnel down
```

Khi tunnel down, `ROUTING_MODE=auto` tự động fallback sang `claude_cli` hoặc Anthropic API.

**Limitation 3: pgvector extension**

Đã giải quyết: `docker-compose.yml` của Argo đã dùng `pgvector/pgvector:pg16`. Dokploy Compose mode đọc file này nguyên vẹn — zero config thêm.

---

## Thứ tự thực hiện (Priority order)

```
Week 1: Phase 1 — Memory fixes (critical, ảnh hưởng mọi sessions)
  ├── Fix 1: memory_recall → memory_smart_search        (1 giờ)
  ├── Fix 2: Wire memory vào pipeline runner             (2 giờ)
  ├── Fix 3: Post-session reflection                     (1 giờ)
  ├── Fix 4: Set ARGOMEMORY_MCP_PATH trong .env         (30 phút)
  └── Fix 5: Celery Beat + consolidation task            (4 giờ)

Week 2: Phase 2 — OMNI integration
  ├── OMNI HTTP adapter (adapter.py)                     (3 giờ)
  ├── omni_svc.py trong Argo backend                     (2 giờ)
  ├── Wire vào engineer.py                               (1 giờ)
  └── Ingest OMNI skills vào Chiron (long-term)         (2 giờ)

Week 3: Phase 3 — Automation
  ├── Celery Beat config                                 (2 giờ)
  ├── Webhook endpoint (/webhooks/github)               (1 ngày)
  └── n8n deploy + workflow setup                       (4 giờ)

Week 4: Phase 4 — Dokploy deployment
  ├── docker-compose.prod.yml                            (4 giờ)
  ├── GitHub Actions release workflow                    (2 giờ)
  ├── Cloudflare Tunnel cho Ollama                       (1 giờ)
  └── Dokploy setup + DNS                                (2 giờ)
```

---

## Dependency map

```
Phase 1 (Memory)
    └── không phụ thuộc gì, có thể bắt đầu ngay

Phase 2 (OMNI)
    └── không phụ thuộc Phase 1, parallel được

Phase 3 (Automation)
    └── Celery Beat cần Phase 1 (memory consolidation task)
    └── Webhook độc lập

Phase 4 (Dokploy)
    └── cần Phase 1, 2, 3 để có full stack
    └── pgvector đã solved trong hiện tại docker-compose.yml
```

---

## Quick wins (làm ngay, < 1 giờ mỗi cái)

1. **Set `ARGOMEMORY_MCP_PATH`** trong `.env` → Claude CLI sessions có native memory access
2. **Đổi `memory_recall` → `memory_smart_search`** trong `memory_svc.py` → recall quality tốt hơn ngay
3. **Add `OMNI_URL=` vào config.py** (empty = disabled) → safe to add now, wire later
4. **Add `pgvector/pgvector:pg16` note** vào `DOCKER.md` → Dokploy users biết dùng image nào
