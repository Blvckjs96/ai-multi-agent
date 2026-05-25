# Argo Mega Integration Plan
> Tác giả: Claude | Ngày: 2026-05-22 | Trạng thái: **DRAFT — chờ xác nhận trước khi implement**

---

## 1. Tổng quan & Trạng thái hiện tại

### Những gì đã được làm (không cần làm lại)

| Thành phần | Trạng thái | Ghi chú |
|---|---|---|
| `backend/app/argon/` | ✅ Đã copy từ Arkon | Toàn bộ AI, MCP, services, models, routes |
| `argorouter/` | ✅ Đã copy từ 9router | Skills đã rename sang `argorouter-*` |
| `INTEGRATION_PLAN.md` | ✅ Đã có plan Phases 1-9 | Tham chiếu architecture tổng thể |

### Những gì CẦN làm (scope của plan này)

| Thành phần | Trạng thái | Ưu tiên |
|---|---|---|
| **5 Bug fixes** | ❌ Chưa làm | CRITICAL |
| **Argon routes → v1_router** | ❌ Chưa wire | HIGH |
| **DB migration 0007 (Argon models)** | ❌ Chưa tạo | HIGH |
| **Auth compat (User ↔ Employee)** | ❌ Chưa wire | HIGH |
| **Codegraph copy + integration** | ❌ Chưa copy | HIGH |
| **Frontend: Wiki panel** | ❌ Chưa build | HIGH |
| **Frontend: Argorouter panel** | ❌ Chưa build | MEDIUM |
| **Frontend: Codegraph panel** | ❌ Chưa build | MEDIUM |
| **Wiki = Code Graph (innovation)** | ❌ Chưa design | HIGH |
| **Skills merge + CLAUDE.md update** | ❌ Chưa làm | MEDIUM |
| **Tauri production build fix** | ❌ Chưa làm | MEDIUM |

---

## 2. Architecture Tổng thể Sau Integration

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ARGO — Tauri 2 Desktop App                           │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Workspace Tabs: [ai_multi_agent ●] [my-blog ○] [+ Add repo]   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  NavRail (9 tabs):                                                     │
│  💬 Chat | ⚡ Pipeline | 📚 Wiki | 🕸 Codegraph | ⏱ Timeline |       │
│  📋 Tasks | 🐙 GitHub | 🔀 Argorouter | ⚙ Settings                    │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │ HTTP/SSE (Tauri → FastAPI:8001)
┌──────────────────────────────▼─────────────────────────────────────────┐
│                   Argo Backend (FastAPI, port 8001)                     │
│                                                                        │
│  Existing:  /chat, /pipeline, /chiron, /providers, /workspace          │
│  NEW Argon: /argon/wiki, /argon/sources, /argon/skills,               │
│             /argon/projects, /argon/rbac, /argon/mcp                  │
│  NEW:       /codegraph/{workspace_id}/... (proxy to codegraph MCP)    │
└──────┬───────────────────────┬──────────────────────────────────────────┘
       │                       │
       │                ┌──────▼──────────────────────────────────────┐
       │                │  Argorouter (Node.js, port 20128)           │
       │                │  AI Gateway: 40+ providers, RTK compression │
       │                │  Auto-fallback, usage tracking              │
       │                └─────────────────────────────────────────────┘
       │
┌──────▼───────────────────────────────────────────────────────────────┐
│  PostgreSQL + pgvector | Redis | MinIO                                │
│  Argon models: Employee, WikiPage, Source, Skill, Project, RBAC      │
│  Existing: User, Workspace, ChironPage, ProviderConfig, etc.          │
│  New: CodegraphNode, CodegraphEdge (per workspace)                    │
└──────────────────────────────────────────────────────────────────────┘

Codegraph MCP Servers (per workspace, dynamic port):
  Workspace A → codegraph-mcp process on port 20201
  Workspace B → codegraph-mcp process on port 20202
```

---

## 3. Phase 0: Fix 5 Critical Issues

> Đây là những fix KHÔNG phụ thuộc vào integration. Làm trước, độc lập.

### 0.1 Git Diff Preview trước khi Confirm (CRITICAL)

**Vấn đề:** User nhấn Confirm mà không thấy code thay đổi gì → sợ hãi.

**Giải pháp:**
- Backend: Khi Claude CLI ở plan mode và user nhấn confirm, trước khi execute, gọi `git diff HEAD` trong workspace path, stream về frontend.
- Frontend: Render diff với syntax highlighting (màu xanh/đỏ theo unified diff format).

**Files thay đổi:**

| File | Action | Change |
|---|---|---|
| `backend/app/services/claude_cli.py` | MODIFY | Thêm `get_pending_diff(workspace_path)` → chạy `git diff HEAD --unified=5` |
| `backend/app/api/routes/v1/chat.py` | MODIFY | Endpoint `GET /chat/{id}/diff` trả về unified diff string |
| `frontend/src/components/chat/ConfirmBanner.jsx` | MODIFY | Thêm `DiffViewer` expandable section bên dưới nút Confirm |
| `frontend/src/components/chat/DiffViewer.jsx` | CREATE | Component render unified diff với line-level color coding |

**Logic DiffViewer:**
```jsx
// DiffViewer.jsx — parse unified diff, render +/- lines
// Không cần thư viện nặng, parse thủ công:
// Lines starting with '+' → green (#00ff9d20 bg, #00ff9d text)
// Lines starting with '-' → red (#ff4d4d20 bg, #ff6b6b text)
// Lines starting with '@@' → blue header
// Collapsible: default collapsed, click để expand
```

**UX flow:**
```
Claude proposes plan → ConfirmBanner appears
  [Expand diff ▼] button → fetches /chat/{id}/diff → shows DiffViewer
  [Confirm] [Cancel] buttons remain always visible
```

---

### 0.2 Auto-inject Workspace/Chiron Context vào Chat (HIGH)

**Vấn đề:** Chat bị "mù" — không biết workspace context, không đọc Chiron wiki.

**Giải pháp:**
- Khi user gửi message trong workspace, tự động inject vào system prompt:
  1. Workspace context (repo path, language stack từ README)
  2. Top 3-5 Chiron wiki pages liên quan nhất (semantic search với user query)
  3. Active codegraph summary (sau khi Phase codegraph done)

**Files thay đổi:**

| File | Action | Change |
|---|---|---|
| `backend/app/services/triage.py` | MODIFY | Thêm `build_context_injection(query, workspace_id)` |
| `backend/app/api/routes/v1/chat.py` | MODIFY | Gọi context injection trước khi forward tới Claude CLI |
| `backend/app/services/claude_cli.py` | MODIFY | Accept `system_context: str` param, append vào `--append-system-prompt` |
| `backend/app/chiron/ai/embedding_service.py` | USE | Dùng để semantic search wiki pages |

**Context injection format:**
```
--- WORKSPACE CONTEXT ---
Repo: ai_multi_agent
Path: /Users/jason/Documents/ai_multi_agent
Stack: Python/FastAPI, TypeScript/React, PostgreSQL

--- RELEVANT WIKI PAGES ---
[Page: Architecture Overview]
{top 500 chars của page}

[Page: API Conventions]  
{top 500 chars của page}
--- END CONTEXT ---
```

---

### 0.3 Multi-Workspace Tabs (MEDIUM)

**Vấn đề:** Chỉ có 1 workspace active/lần. Khó cho người maintain nhiều microservices.

**Giải pháp:**
- Backend: `Workspace` model đã có. Thêm endpoint `GET /workspace/active-list` trả về danh sách workspace đang mở.
- Frontend: Thêm workspace tab bar phía trên NavRail.

**Files thay đổi:**

| File | Action | Change |
|---|---|---|
| `backend/app/api/routes/v1/workspace.py` | MODIFY | Thêm `GET /workspace/open`, `POST /workspace/{id}/open`, `POST /workspace/{id}/close` |
| `frontend/src/components/WorkspaceTabs.jsx` | CREATE | Tab bar hiển thị open workspaces, click để switch |
| `frontend/src/App.jsx` | MODIFY | Inject `<WorkspaceTabs>` phía trên content, pass `activeWorkspace` xuống tất cả panels |
| `frontend/src/hooks/useWorkspace.js` | CREATE | Hook quản lý workspace state (open list, active, switch) |

**WorkspaceTabs UI:**
```
[ai_multi_agent ●]  [my-blog ○]  [api-service ●]  [+ Add Workspace]
    ↑ active+streaming  ↑ idle      ↑ background job running
```

**State:**
- `openWorkspaces: Workspace[]` — persisted in localStorage
- `activeWorkspaceId: UUID` — which workspace all panels are scoped to
- Badge trên tab: số uncommitted changes hoặc background tasks

---

### 0.4 Memory Brain (Tier 1 & 3) (MEDIUM)

**Tier 1 (Task Context — per conversation):**
- Đã có conversation model. Inject conversation summary khi resume.
- Thêm `POST /chat/{id}/summarize` → tóm tắt conversation dùng haiku, lưu vào `conversation.summary`.

**Tier 3 (Project Knowledge — Chiron/Argon wiki):**
- Đây chính là Argon wiki sau khi Phase 1 xong.
- Khi user ingest docs → MRP pipeline → wiki pages → AI đọc qua MCP.

**Files thay đổi:**

| File | Action | Change |
|---|---|---|
| `backend/app/api/routes/v1/chat.py` | MODIFY | Khi resume session, fetch conversation.summary, inject vào prompt |
| `backend/app/services/claude_cli.py` | MODIFY | Accept `memory_context: list[str]` → append vào system prompt |
| `backend/app/schemas/conversations.py` | MODIFY | Thêm field `summary: str \| None` |

---

### 0.5 Tauri Production Build (MEDIUM)

**Vấn đề:** PATH limitations trong macOS .app bundle, Rust PTY edge cases.

**Giải pháp:**

| File | Action | Change |
|---|---|---|
| `frontend/src-tauri/src/lib.rs` | MODIFY | Mở rộng PATH khi spawn subprocesses: thêm `/opt/homebrew/bin`, `/usr/local/bin`, `~/.nvm/versions/node/*/bin` |
| `frontend/src-tauri/tauri.conf.json` | MODIFY | Thêm allowlist cho tất cả shell commands cần thiết |
| `backend/app/core/cli_utils.py` | MODIFY | Đảm bảo binary discovery không phụ thuộc shell PATH |
| `Makefile` | MODIFY | Thêm `make build-tauri` target với environment setup đúng |

---

## 4. Phase 1: Wire Argon Backend vào FastAPI

> Argon backend đã copy xong. Phase này kết nối nó vào router và database.

### 4.1 Auth Compatibility Layer

Argon dùng `Employee` model, Argo dùng `User` model. Giải pháp: adapter pattern.

File đã tồn tại: `backend/app/argon/services/auth_compat.py`
- Cần implement: `user_to_employee(user: User) -> Employee` converter
- Cần: inject Argo's `CurrentUser` into Argon's permission engine

### 4.2 Database Migration 0007 (Argon Models)

File: `backend/alembic/versions/0007_argon_schema.py`

Argon models cần tạo (từ `backend/app/argon/models.py`, 1243 lines):

```python
# Tables to create in migration 0007:
employees           # maps to User via user_id FK
departments
roles  
role_permissions
employee_roles
projects (workspaces trong Argon)
project_members
sources             # uploaded documents
source_departments
source_images
source_chunk_extracts      # MRP Phase 1 output
source_compilation_plans   # MRP Phase 2 output
wiki_pages
wiki_links
wiki_page_drafts
wiki_page_revisions
wiki_draft_rounds
knowledge_types
skills
skill_versions
skill_departments
skill_contributions
embedding_jobs
audit_logs
notifications
mcp_query_logs
app_configs        # key-value store
# NOTE: wiki_page_embedding_* tables cần pgvector extension
# → Tạo conditionally (skip nếu pgvector chưa installed)
```

**Migration strategy:**
```python
# 0007_argon_schema.py
# Kiểm tra pgvector trước:
def upgrade():
    has_pgvector = _check_pgvector()
    _create_base_tables()
    if has_pgvector:
        _create_embedding_tables()
    else:
        print("WARNING: pgvector not found, skipping embedding tables")
        print("Run: brew install pgvector && restart postgres")
```

### 4.3 Wire Argon Routes vào v1_router

File: `backend/app/api/routes/v1/__init__.py`

Thêm các routes sau (tất cả dưới prefix `/argon`):

```python
from app.argon.api import (
    wiki, wiki_drafts, wiki_images,
    sources, knowledge_types,
    projects, rbac, roles, scopes,
    skills, skill_contributions,
    audit, notifications, notes,
    admin_settings, admin_models,
    admin_embeddings, admin_stats,
)

# Trong v1_router:
v1_router.include_router(wiki.router, prefix="/argon/wiki", tags=["argon:wiki"])
v1_router.include_router(sources.router, prefix="/argon/sources", tags=["argon:sources"])
v1_router.include_router(skills.router, prefix="/argon/skills", tags=["argon:skills"])
v1_router.include_router(projects.router, prefix="/argon/projects", tags=["argon:projects"])
v1_router.include_router(rbac.router, prefix="/argon/rbac", tags=["argon:rbac"])
# ... etc
```

### 4.4 Wire Argon MCP Server

File: `backend/app/main.py`

Argon MCP server (`backend/app/argon/mcp/server.py`) cần mount vào FastAPI:

```python
# main.py — thêm sau current mounts
from app.argon.mcp.server import create_argon_mcp_server

@app.on_event("startup")
async def startup():
    argon_mcp = create_argon_mcp_server()
    app.mount("/argon/mcp", argon_mcp.get_asgi_app())
```

### 4.5 Worker Integration (MRP Pipeline)

Argon's MRP pipeline chạy qua arq workers. File: `backend/app/argon/worker.py`

Cần add Argon worker settings vào Argo's worker runner. Argo hiện đang dùng Celery + arq. Argon dùng arq only.

**Strategy:** Register Argon's arq tasks vào existing arq worker:

```python
# backend/app/worker/__init__.py — thêm Argon tasks
from app.argon.worker import (
    ingest_file_task,
    ingest_mrp_task,
    ingest_refine_task,
    caption_images_task,
)
```

---

## 5. Phase 2: Codegraph — Copy & Integration

### 5.1 Copy Codegraph vào Argo

**Nguồn:** `/Volumes/Jason's SSD/Documents/codegraph/`
**Đích:** `codegraph/` tại root của Argo

```bash
# Copy toàn bộ:
cp -r "/Volumes/Jason's SSD/Documents/codegraph/" codegraph/
# Loại bỏ những thứ không cần:
rm -rf codegraph/.git codegraph/node_modules
```

**Files/skills quan trọng cần giữ:**
- `codegraph/src/` — toàn bộ TypeScript source
- `codegraph/.claude/skills/` — `add-lang/`, `agent-eval/`
- `codegraph/README.md`, `codegraph/CLAUDE.md`, `codegraph/BUNDLING.md`
- `codegraph/package.json`, `codegraph/tsconfig.json`

### 5.2 Codegraph làm gì trong Argo

**Core innovation:** Wiki không chỉ lưu knowledge — AI đọc **code graph** để hiểu bất kỳ repo nào mà KHÔNG cần grep/find/Read tool.

```
Workspace mở lần đầu:
  1. Codegraph tự động index repo → SQLite DB tại `.argo/codegraph.db`
  2. MCP server khởi động, expose 8 tools cho Claude
  3. Claude dùng `codegraph_context("authentication")` thay vì grep

Khi AI làm việc:
  KHÔNG làm: grep "auth" -r src/ → Read auth.ts → Read session.ts → ...
  THAY BẰNG:  codegraph_context("authentication") → 1 call, full context
```

**8 tools codegraph expose:**
1. `codegraph_search` — tìm symbol theo tên
2. `codegraph_context` — **PRIMARY** — trả về entry points + call graph + code snippets
3. `codegraph_callers` — ai gọi function này?
4. `codegraph_callees` — function này gọi gì?
5. `codegraph_impact` — thay đổi function này ảnh hưởng gì?
6. `codegraph_node` — chi tiết 1 symbol
7. `codegraph_explore` — source code của nhiều symbols
8. `codegraph_files` — file tree từ index

### 5.3 Per-Workspace Codegraph Management

**Backend service:** `backend/app/services/codegraph_service.py` (CREATE)

```python
class CodegraphService:
    """Manages one codegraph MCP server process per workspace."""
    
    _processes: dict[UUID, asyncio.subprocess.Process] = {}
    _ports: dict[UUID, int] = {}
    BASE_PORT = 20200
    
    async def ensure_indexed(self, workspace: Workspace) -> int:
        """Start codegraph MCP for workspace, return port."""
        if workspace.id in self._processes:
            return self._ports[workspace.id]
        
        port = self._allocate_port()
        db_path = Path(workspace.repo_path) / ".argo" / "codegraph.db"
        
        proc = await asyncio.create_subprocess_exec(
            "node", str(CODEGRAPH_BIN), "--mcp",
            "--db", str(db_path),
            "--port", str(port),
            cwd=workspace.repo_path,
        )
        self._processes[workspace.id] = proc
        self._ports[workspace.id] = port
        return port
    
    async def reindex(self, workspace: Workspace) -> None:
        """Trigger re-index (after git pull, etc.)"""
        ...
```

**API endpoint:** `GET /codegraph/{workspace_id}/status` — trả về indexed nodes count, last sync, MCP port

**Auto-trigger:** Khi workspace được open hoặc git push/pull detected.

### 5.4 Inject Codegraph vào Claude CLI System Prompt

Khi Claude bắt đầu session trong workspace, inject vào MCP config:

```python
# backend/app/services/claude_cli.py
async def build_mcp_config(workspace_id: UUID) -> dict:
    codegraph_port = await codegraph_svc.get_port(workspace_id)
    
    return {
        "servers": {
            "codegraph": {
                "type": "sse",
                "url": f"http://localhost:{codegraph_port}/sse"
            },
            "chiron": {
                "type": "sse", 
                "url": "http://localhost:8001/chiron/mcp"
            },
            "argon": {
                "type": "sse",
                "url": "http://localhost:8001/argon/mcp"
            }
        }
    }
```

### 5.5 Wiki từ Codegraph — Auto Wiki Generation

**Key innovation pipeline:**

```
1. User mở workspace → Codegraph index repo → graph built
2. MRP Pipeline reads graph (qua codegraph tools):
   - MAP phase: đọc graph nodes theo category (services, models, routes)
   - REDUCE phase: tổng hợp thành compilation plan (wiki pages cần tạo)
   - REFINE phase: generate wiki page content từ graph data
   - VERIFY phase: kiểm tra accuracy
   - COMMIT phase: lưu vào Argon wiki

3. Kết quả: Wiki pages về codebase tự động tạo ra:
   - "Architecture Overview" — từ top-level modules + dependencies
   - "API Routes" — từ route nodes
   - "Data Models" — từ class/struct nodes
   - "Service Layer" — từ service classes + their calls
   - "Authentication Flow" — từ auth-related call graphs
```

**New endpoint:** `POST /argon/sources/{workspace_id}/ingest-codegraph`
- Lấy codegraph context → chạy MRP → tạo wiki pages tự động
- Progress via SSE stream

---

## 6. Phase 3: Frontend — Wiki Panel (Argon UI)

> Port key components từ Arkon (Next.js) sang React/Vite cho Argo Tauri app.

### 6.1 Cấu trúc file mới

```
frontend/src/components/wiki/
├── WikiPanel.jsx           # Container chính, tab switcher
├── WikiBrowser.jsx         # Tree browser + content view (2 pane)
├── WikiPage.jsx            # Render markdown wiki page
├── WikiSearch.jsx          # Search dialog (semantic + full-text)
├── WikiGraph.jsx           # Knowledge graph visualization (D3 force)
├── WikiEditor.jsx          # Markdown editor cho editing/drafts
├── WikiDraftBanner.jsx     # Banner hiển thị khi page có pending draft
├── WikiDraftDiff.jsx       # Diff viewer cho draft review
├── WikiDraftReview.jsx     # Review queue (editor+)
├── sources/
│   ├── SourcesManager.jsx  # Upload + list sources
│   ├── SourceCard.jsx      # Individual source với status/progress
│   └── PlanReviewDialog.jsx# MRP Plan review (approve/reject)
└── skills/
    ├── SkillsBrowser.jsx   # Browse skill library
    ├── SkillCard.jsx
    └── SkillEditor.jsx     # Contribute to skills
```

### 6.2 WikiPanel — Main Container

3 tabs nội bộ:
1. **Wiki** — Tree browser + page content + graph mini
2. **Sources** — Upload docs, view ingestion status, plan review
3. **Skills** — Browse/contribute skills

### 6.3 WikiBrowser — 2-Pane Layout

```
┌────────────────────────────────────────────────┐
│  [🔍 Search]  [+ New Page]  [📊 Graph]         │
├──────────────┬─────────────────────────────────┤
│ Tree          │ Page Content                    │
│               │                                 │
│ 📁 Architecture│ # Architecture Overview       │
│   📄 Overview  │                                │
│   📄 API Guide │ The Argo backend follows a    │
│ 📁 Data Models │ layered architecture...        │
│   📄 User      │                                │
│   📄 Workspace │ ## Layers                      │
│ 📁 Services   │ ...                             │
│               │                                 │
│               │ [Edit] [Draft history]          │
└──────────────┴─────────────────────────────────┘
```

### 6.4 WikiGraph — D3 Force Visualization

Port từ Arkon's `wiki-graph/` (React force graph):
- Nodes: wiki pages, sources
- Edges: wikilinks `[[slug]]`, source references
- Click node → navigate to page
- Hover → preview tooltip
- Mini version embedded trong page sidebar

**Library:** `react-force-graph-2d` (đã có trong Arkon, thêm vào package.json)

### 6.5 SourcesManager

```
┌────────────────────────────────────────────────┐
│  [+ Upload Document]  Filter: [All ▼]          │
├────────────────────────────────────────────────┤
│  📄 architecture.pdf      ● Compiled  [Diff]   │
│  📄 api-guide.md          ⏳ Mapping... 45%    │
│  📄 deployment.docx       🔴 Failed   [Retry]  │
│  📄 README.md             ⚪ Pending           │
└────────────────────────────────────────────────┘
```

Khi source ở status `review_required` → hiển thị [Review Plan] button → mở `PlanReviewDialog`.

---

## 7. Phase 4: Frontend — Argorouter Panel

> UI quản lý AI gateway (9router/Argorouter).

### 7.1 Cấu trúc

```
frontend/src/components/argorouter/
├── ArgorouterPanel.jsx     # Container, 3 tabs
├── ProviderConnections.jsx # List providers, add/edit/remove
├── UsageStats.jsx          # Token/cost charts (recharts)
├── ModelAliases.jsx        # Manage model aliases (kr/*)
└── ArgorouterStatus.jsx    # Health check, version, port
```

### 7.2 ArgorouterPanel — 3 Tabs

1. **Connections** — Quản lý provider connections (Claude OAuth, OpenAI key, Gemini, Kiro...)
2. **Usage** — Charts: tokens used, cost by provider, requests/day
3. **Config** — RTK settings, combo strategies, model aliases

### 7.3 Integration với Argo Backend

Argo backend proxy requests tới Argorouter:

```python
# backend/app/api/routes/v1/argorouter.py (CREATE)
import httpx

ARGOROUTER_URL = "http://localhost:20128"

@router.get("/argorouter/status")
async def get_status():
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{ARGOROUTER_URL}/api/health")
        return r.json()

@router.get("/argorouter/providers")
async def get_providers():
    ...
```

### 7.4 Argorouter như AI Gateway cho Argo

Khi routing mode = `argorouter`, Argo backend forward LLM calls qua Argorouter:

```python
# backend/app/agents/pipeline/model_router.py — thêm provider mới
class Provider(StrEnum):
    ANTHROPIC  = "anthropic"
    OLLAMA     = "ollama"
    CLAUDE_CLI = "claude_cli"
    ARGOROUTER = "argorouter"  # NEW — proxy tất cả qua Argorouter

# Khi provider = ARGOROUTER:
# → Forward request tới http://localhost:20128/v1/chat/completions
# → Argorouter xử lý routing, fallback, RTK compression
# → Return response
```

---

## 8. Phase 5: Frontend — Codegraph Panel

```
frontend/src/components/codegraph/
├── CodegraphPanel.jsx      # Container
├── GraphView.jsx           # D3/force-graph visualization
├── SymbolSearch.jsx        # Symbol search bar
├── ContextViewer.jsx       # Show codegraph_context result (markdown)
├── ImpactAnalysis.jsx      # Show impact radius of a symbol
└── IndexStatus.jsx         # Nodes count, last sync, languages
```

### 8.1 CodegraphPanel Layout

```
┌────────────────────────────────────────────────┐
│  Codegraph — ai_multi_agent                    │
│  ● 12,847 nodes · 45,231 edges · Python/TS    │
│  Last indexed: 2 min ago  [Re-index]           │
├────────────────────────────────────────────────┤
│  [🔍 Search symbols...]                        │
├────────────────────┬───────────────────────────┤
│  Graph             │  Context                  │
│                    │                           │
│  [D3 force graph]  │  codegraph_context        │
│  nodes = files     │  ("authentication"):      │
│  edges = imports   │                           │
│                    │  ## Entry Points          │
│  Click node →      │  - auth.py:LoginService   │
│  shows context     │  - deps.py:CurrentUser    │
│                    │                           │
│                    │  ## Call Flow             │
│                    │  LoginService.login()     │
│                    │    → verify_password()    │
│                    │    → create_access_token()│
└────────────────────┴───────────────────────────┘
```

---

## 9. Phase 6: Wiki = Code Graph (Key Innovation)

> **Mục tiêu:** Wiki không chỉ là nơi lưu trữ — AI đọc toàn bộ graph để hiểu codebase mà không cần search file hay gọi tools.

### 9.1 Luồng hoạt động

```
Bước 1: User mở workspace
  → Codegraph tự động index (background)
  → Wiki check: có wiki pages về codebase chưa?
  
Bước 2: Nếu chưa có wiki (repo mới):
  → Button [Auto-generate Wiki from Codebase] trong WikiPanel
  → Backend gọi: codegraph → MRP pipeline → wiki pages
  → Progress: "Analyzing codebase... Mapping 847 symbols..."
  
Bước 3: Wiki được tạo tự động:
  - "Architecture Overview" (từ module graph)
  - "API Endpoints" (từ route nodes × framework detection)
  - "Data Models" (từ class/struct nodes)
  - "Service Layer" (từ service class call graphs)
  - "Authentication & Authorization" (từ auth symbol cluster)
  - "Database Schema" (từ ORM models)
  
Bước 4: Khi AI (Claude) làm việc:
  System prompt injection:
  "You have access to a code intelligence graph via MCP tools.
   ALWAYS use codegraph_context() BEFORE using grep or Read tools.
   The graph has {node_count} symbols indexed from this repo.
   
   Use: codegraph_context('what you want to understand')
   Never do: grep -r 'keyword' or Read multiple files to understand structure."
```

### 9.2 MRP Pipeline đọc Codegraph

**Mapper phase (mới):** Thay vì chỉ đọc source documents, mapper cũng đọc codegraph:

```python
# backend/app/argon/ai/mrp/mapper.py — thêm codegraph source

class CodegraphMapper:
    """Phase 1: Extract structured knowledge from codegraph."""
    
    async def map_symbol_cluster(
        self, 
        cluster_name: str,  # e.g., "authentication"
        codegraph_port: int
    ) -> ChunkExtract:
        # Gọi codegraph_context qua HTTP/MCP
        context = await self._query_codegraph(
            tool="codegraph_context",
            args={"query": cluster_name}
        )
        # Trả về structured extract
        return ChunkExtract(
            content=context.markdown,
            knowledge_type="codebase_architecture",
            page_references=[cluster_name],
        )
```

### 9.3 Wiki Page Structure từ Code

Mỗi wiki page tự động generate có:
- **Last updated** dựa trên git blame của related files
- **Accuracy score** (% symbols còn tồn tại trong codegraph)
- **Auto-refresh button** — re-run MRP cho page đó khi code thay đổi
- **Source links** — click symbol trong wiki → jump to file:line

### 9.4 Divergence Detection

Khi code thay đổi mà wiki chưa update:

```python
# backend/app/services/wiki_freshness.py (CREATE)
async def check_freshness(wiki_page: WikiPage, workspace: Workspace) -> FreshnessReport:
    """So sánh wiki page với current codegraph."""
    
    # Extract symbols mentioned in wiki page content
    symbols_in_wiki = extract_symbol_references(wiki_page.content_md)
    
    # Check which symbols still exist in codegraph
    still_exist = await codegraph_svc.batch_lookup(symbols_in_wiki, workspace.id)
    
    missing = set(symbols_in_wiki) - set(still_exist)
    accuracy = len(still_exist) / len(symbols_in_wiki) if symbols_in_wiki else 1.0
    
    return FreshnessReport(
        accuracy=accuracy,
        missing_symbols=missing,
        needs_refresh=accuracy < 0.8  # < 80% accuracy → warn user
    )
```

---

## 10. Phase 7: Skills Integration

### 10.1 Merge All Skills vào `skills/` tại root

**Nguồn:**
- `backend/app/argon/skills/argon-query/`, `argon-edit/`, `argon-review/` → `skills/argon-*/`
- `argorouter/skills/argorouter/`, `argorouter-*/` → `skills/argorouter-*/` (đã có)
- `codegraph/.claude/skills/` → `skills/codegraph-*/`

**Kết quả final `skills/` structure:**
```
skills/
├── argon-query/SKILL.md      # Query Argon wiki
├── argon-edit/SKILL.md       # Edit/propose wiki changes
├── argon-review/SKILL.md     # Review wiki drafts
├── argorouter/SKILL.md       # Use Argorouter AI gateway
├── argorouter-chat/SKILL.md
├── argorouter-embeddings/SKILL.md
├── argorouter-image/SKILL.md
├── argorouter-tts/SKILL.md
├── argorouter-stt/SKILL.md
├── argorouter-web-fetch/SKILL.md
├── argorouter-web-search/SKILL.md
├── codegraph-explore/SKILL.md  # Explore codebase via graph
└── codegraph-add-lang/SKILL.md # Add new language support
```

### 10.2 Update CLAUDE.md

Thêm vào `CLAUDE.md` tại root hướng dẫn về:
1. Codegraph MCP tools — khi nào dùng, cách dùng
2. Argon wiki tools — search, edit, propose
3. Argorouter — biết rằng AI calls có thể route qua đây

### 10.3 Update AGENTS.md

Thêm section về multi-agent với codegraph context pre-loaded.

---

## 11. UI Layout Redesign — Lanes-Inspired Architecture

> **Insight từ Lanes analysis:** Tasks, Chat, Terminal không phải 3 tab riêng — chúng là cùng 1 thực thể. Mỗi **Issue/Task** là 1 autonomous session có PTY terminal + chat riêng. Kanban board là view chính, right panel là workspace của issue đang active.

### 11.1 Layout Tổng thể (2-Column + Global Bar)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  WORKSPACE BAR (trên cùng)                                               │
│  [ai_multi_agent ●]  [my-blog ○]  [api-service ●]  [+ Add repo]         │
│                                          [📚 Wiki] [🕸 Graph] [🔀] [⚙]  │
├─────────────────────┬────────────────────────────────────────────────────┤
│  LEFT — Issue Board │  RIGHT — Issue Workspace                           │
│  (Kanban columns)   │                                                    │
│                     │  ◇ #8  Add CSV export for dashboard   [Mark done] │
│  [+ New Session ⌘N] ├────────────────────────────────────────────────────┤
│  [+ New Terminal ⌘T]│  [Terminal] [Chat] [Description] [Git Changes]    │
│  [Quick Action ▸]   │  [History] [Meta]                                  │
│  [Configure]        │                                                    │
│  ─────────────────  │  ┌──────────────────────────────────────────────┐ │
│  📁 ai_multi_agent  │  │ ─── Claude Code v2.1.81 ─────────────────── │ │
│    🔀 Worktrees     │  │                                              │ │
│    💬 Sessions      │  │  Opus 4.6 (1M context) · Claude Team        │ │
│    📂 Folders       │  │  ~/Documents/ai_multi_agent                 │ │
│  ─────────────────  │  └──────────────────────────────────────────── ┘ │
│  BACKLOG  2         │                                                    │
│  #9  Memory leak    │  > |_                                              │
│  #10 i18n support   │                                                    │
│                     │  ? for shortcuts                                   │
│  PLANNING  4        │                                                    │
│  #7  DB pooling     │                                                    │
│  #5  User prefs  ●  │                                                    │
│  #6  WebSocket      │                                                    │
│  #8  CSV export  ◀  │  ← active issue                                   │
│                     │                                                    │
│  REVIEW  2          │                                                    │
│  #3  Dark mode      │                                                    │
│  #4  Webhook retry  │                                                    │
│                     │                                                    │
│  DONE               │                                                    │
│  ─────────────────  │                                                    │
│  ⚡1  🔀1           │                              v0.28.7-beta          │
└─────────────────────┴────────────────────────────────────────────────────┘
```

### 11.2 Left Panel — Issue Board

**Kanban columns (giống Lanes):**
- `BACKLOG` → `PLANNING` → `IMPLEMENTATION` → `REVIEW` → `DONE` + `MISC`

**Mỗi issue row:**
```
◇ #8  Add CSV export for analytics dashboard    ● Feature  ⓘ
      └─ [worktree icon nếu có] [assignee] [tag badges]
```

**Issue statuses (OSC 633-based, giống Lanes):**
- `○` idle / không có session
- `◉` busy (Claude đang chạy)
- `◎` awaiting_input (at shell prompt — chờ input)
- `●` notification / có thay đổi mới

**Sidebar actions:**
- **`New CLI Session ⌘N`** — tạo issue mới với Claude CLI session, optionally tạo git worktree
- **`New Terminal ⌘T`** — tạo issue với bare shell session (không Claude)
- **`Quick Action ▸`** — quick commands (review changes, add tests, fix lint, refactor) — giống Lanes' built-in prompts
- **`Configure`** — workspace settings

**Under project:**
- **Worktrees** — list git worktrees đang active
- **Sessions** — list all running sessions (cross-issue)
- **Working Folders** — registered repo paths

### 11.3 Right Panel — Issue Workspace (6 Tabs)

Khi click vào issue, right panel hiện 6 tabs (giống Lanes):

| Tab | Icon | Content | Tương đương cũ |
|---|---|---|---|
| **Terminal** | `>_` | PTY xterm.js — Claude CLI hoặc bare shell | TerminalTab |
| **Chat** | 💬 | Chat bubbles view (streaming) | ChatView |
| **Description** | 📝 | Issue description, tags, linked GitHub/Linear | TaskBoard card detail |
| **Git Changes** | 🔀 | Diff + commit history cho issue này | ChangeTimeline |
| **History** | 📜 | Session message history (JSONL replay) | — |
| **Meta** | ℹ | Worktree path, session stats, PID, timing | — |

**Terminal tab — OSC 633 integration:**
- Parse `\e]633;A\a` → set issue status `awaiting_input`
- Parse `\e]633;C\a` → set issue status `busy`
- Parse `\e]633;D;N\a` → set issue status `awaiting_input`, record exit_code
- Parse `\e]633;P;Cwd=/path\a` → update cwd display

**Chat tab:**
- Chat bubbles (streaming) thay vì raw terminal output
- Plan mode toggle: [Plan] / [Implement] — map to `--permission-mode plan`
- Confirm/Cancel buttons khi Claude ở plan mode
- **DiffViewer** embedded dưới ConfirmBanner (fix 0.1)
- Quick commands toolbar: [Review] [Add Tests] [Fix Lint] [Refactor]

**Git Changes tab:**
- `git diff HEAD --unified=5` rendered với syntax highlighting
- Commit history của worktree/branch này
- [Commit] [Revert] actions

**Description tab:**
- Title, description (markdown editor)
- Tags, labels, worktree strategy
- Link to GitHub issue / Linear issue

### 11.4 Global Panels (Top Bar Icons)

4 panels không thuộc về 1 issue cụ thể, accessible qua top-right icons:

| Icon | Panel | Route |
|---|---|---|
| 📚 | **Wiki** (Argon) | Full wiki browser, sources, skills |
| 🕸 | **Codegraph** | Code intelligence graph, symbol search |
| 🔀 | **Argorouter** | AI gateway, provider connections, usage |
| ⚙ | **Settings** | App settings, model selector, integrations |

Click icon → opens as **overlay panel** hoặc **split view**, không replace main layout.

### 11.5 Issue Data Model (Mở rộng Task Model)

Argo hiện có `Task` model. Cần mở rộng hoặc replace bằng model tương đương Lanes' `issues`:

```python
# backend/app/db/models/ — mở rộng Task
class Task(Base, TimestampMixin):
    # Existing fields...
    
    # NEW (Lanes-inspired):
    cwd: Mapped[str | None]                    # working directory (repo path)
    step: Mapped[str]                          # backlog|planning|implementation|review|done|misc
    worktree_strategy: Mapped[str | None]       # create|existing|none
    worktree_path: Mapped[str | None]           # path to worktree
    worktree_name: Mapped[str | None]           # branch name
    base_branch: Mapped[str | None]             # base branch for worktree
    external_provider: Mapped[str | None]       # github|linear
    external_id: Mapped[str | None]
    external_key: Mapped[str | None]            # '#42', 'ENG-123'
    external_url: Mapped[str | None]
    sort_order: Mapped[float]                   # for drag-drop reordering
```

### 11.6 Session Data Model (Per-Issue)

```python
class TaskSession(Base, TimestampMixin):
    """One Claude CLI / shell session per task."""
    task_id: Mapped[UUID]                       # FK Task
    shell: Mapped[str] = "zsh"                 # shell binary
    cli: Mapped[str] = "claude"                # 'claude'|'shell'
    runtime_status: Mapped[str] = "none"       # none|starting|busy|awaiting_input|stopped
    pid: Mapped[int | None]
    exit_code: Mapped[int | None]
    started_at: Mapped[datetime | None]
    stopped_at: Mapped[datetime | None]
    claude_session_id: Mapped[str | None]      # for --resume
    plan_mode: Mapped[bool] = False            # --permission-mode plan
    workspace_id: Mapped[UUID]                 # FK Workspace
```

### 11.7 Quick Commands (Built-in Prompts)

Giống Lanes' `quick_commands` table — built-in prompt templates:

| ID | Name | Prompt |
|---|---|---|
| `review-changes` | Review Changes | "Analyze recent changes. Cover happy paths, edge cases, security..." |
| `add-tests` | Add Tests | "Analyze recent changes and add comprehensive tests..." |
| `fix-lint` | Fix Lint | "Check and fix all linting errors in changed files." |
| `refactor` | Refactor | "Review recent changes and refactor for clarity, simplicity..." |
| `explain-code` | Explain Code | "Explain the code structure and recent changes..." |
| `generate-docs` | Generate Docs | "Generate documentation for recent changes..." |

Template syntax: `{{workspacePath}}`, `{{baseBranch}}`, `{{issueName}}`

### 11.8 Git Worktree Integration

Mỗi issue CÓ THỂ có worktree riêng (optional, giống Lanes):

**Worktree strategies:**
- `create` — auto-tạo `git worktree add` khi session start
- `existing` — dùng `worktree_path` có sẵn
- `none` — dùng `cwd` của task (default, không isolated)

**Tauri Rust commands cần thêm:**
```rust
#[tauri::command]
async fn worktree_create(repo_path: String, branch: String) -> Result<String, String>

#[tauri::command]  
async fn worktree_list(repo_path: String) -> Result<Vec<WorktreeInfo>, String>

#[tauri::command]
async fn worktree_remove(worktree_path: String) -> Result<(), String>

#[tauri::command]
async fn worktree_status(worktree_path: String) -> Result<String, String>
```

### 11.9 StatusBar (Bottom)

```
[⚡1 running]  [🔀1 waiting]          [model: claude-sonnet-4-6 ▼]  [v0.28.7]
```
- Left: active sessions count + waiting sessions
- Right: active model selector + version

### 11.10 Keyboard Shortcuts (giống Lanes)

| Shortcut | Action |
|---|---|
| `⌘N` | New CLI Session (tạo issue + Claude session) |
| `⌘T` | New Terminal (bare shell session) |
| `⌘W` | Close/stop current session |
| `⌘1-6` | Switch right panel tabs |
| `▸` | Quick Action menu |
| `⌘K` | Command palette |

### 11.11 Files Thay đổi cho Layout Redesign

| File | Action | Change |
|---|---|---|
| `frontend/src/App.jsx` | MAJOR MODIFY | Thay NavRail bằng 2-column layout |
| `frontend/src/components/layout/IssueBoard.jsx` | CREATE | Left panel: Kanban issue list |
| `frontend/src/components/layout/IssueWorkspace.jsx` | CREATE | Right panel: 6-tab workspace |
| `frontend/src/components/layout/WorkspaceBar.jsx` | CREATE | Top bar với workspace tabs + global icons |
| `frontend/src/components/layout/IssueRow.jsx` | CREATE | Single issue row trong Kanban |
| `frontend/src/components/layout/QuickCommands.jsx` | CREATE | Quick action menu |
| `frontend/src/components/chat/DiffViewer.jsx` | CREATE | Diff view trong Chat tab |
| `frontend/src/hooks/useTaskSession.js` | CREATE | Hook quản lý PTY session per task |
| `backend/app/db/models/tasks.py` | MODIFY | Thêm worktree, step, external fields |
| `backend/app/db/models/task_session.py` | CREATE | Per-task session model |
| `backend/app/api/routes/v1/task_board.py` | MODIFY | Thêm session management endpoints |
| `backend/app/api/routes/v1/worktree.py` | CREATE | Git worktree management |
| `frontend/src-tauri/src/lib.rs` | MODIFY | Thêm worktree_* Tauri commands |

---

## 12. File Map Chi tiết

### Phase 0 (Bug Fixes)

| File | Action | Phase |
|---|---|---|
| `backend/app/services/claude_cli.py` | MODIFY | 0.1, 0.2, 0.4 |
| `backend/app/api/routes/v1/chat.py` | MODIFY | 0.1, 0.2, 0.4 |
| `frontend/src/components/chat/ConfirmBanner.jsx` | MODIFY | 0.1 |
| `frontend/src/components/chat/DiffViewer.jsx` | CREATE | 0.1 |
| `backend/app/services/triage.py` | MODIFY | 0.2 |
| `backend/app/api/routes/v1/workspace.py` | MODIFY | 0.3 |
| `frontend/src/components/WorkspaceTabs.jsx` | CREATE | 0.3 |
| `frontend/src/hooks/useWorkspace.js` | CREATE | 0.3 |
| `frontend/src/App.jsx` | MODIFY | 0.3, 0.5, 11 |
| `frontend/src-tauri/src/lib.rs` | MODIFY | 0.5 |

### Phase 1 (Wire Argon Backend)

| File | Action | Phase |
|---|---|---|
| `backend/alembic/versions/0007_argon_schema.py` | CREATE | 1.2 |
| `backend/app/api/routes/v1/__init__.py` | MODIFY | 1.3 |
| `backend/app/argon/services/auth_compat.py` | MODIFY | 1.1 |
| `backend/app/main.py` | MODIFY | 1.4 |
| `backend/app/worker/__init__.py` | MODIFY | 1.5 |

### Phase 2 (Codegraph)

| File | Action | Phase |
|---|---|---|
| `codegraph/` (entire dir) | COPY FROM SOURCE | 2.1 |
| `backend/app/services/codegraph_service.py` | CREATE | 2.3 |
| `backend/app/api/routes/v1/codegraph.py` | CREATE | 2.3 |
| `backend/app/api/routes/v1/__init__.py` | MODIFY | 2.3 |
| `backend/app/services/claude_cli.py` | MODIFY | 2.4 |
| `backend/app/argon/ai/mrp/mapper.py` | MODIFY | 2.5 |

### Phase 3-5 (Frontend Panels)

| File | Action | Phase |
|---|---|---|
| `frontend/src/components/wiki/WikiPanel.jsx` | CREATE | 3 |
| `frontend/src/components/wiki/WikiBrowser.jsx` | CREATE | 3 |
| `frontend/src/components/wiki/WikiPage.jsx` | CREATE | 3 |
| `frontend/src/components/wiki/WikiGraph.jsx` | CREATE | 3 |
| `frontend/src/components/wiki/WikiEditor.jsx` | CREATE | 3 |
| `frontend/src/components/wiki/WikiDraftReview.jsx` | CREATE | 3 |
| `frontend/src/components/wiki/sources/SourcesManager.jsx` | CREATE | 3 |
| `frontend/src/components/wiki/skills/SkillsBrowser.jsx` | CREATE | 3 |
| `frontend/src/components/argorouter/ArgorouterPanel.jsx` | CREATE | 4 |
| `frontend/src/components/argorouter/ProviderConnections.jsx` | CREATE | 4 |
| `frontend/src/components/argorouter/UsageStats.jsx` | CREATE | 4 |
| `backend/app/api/routes/v1/argorouter.py` | CREATE | 4 |
| `frontend/src/components/codegraph/CodegraphPanel.jsx` | CREATE | 5 |
| `frontend/src/components/codegraph/GraphView.jsx` | CREATE | 5 |
| `frontend/src/components/codegraph/ContextViewer.jsx` | CREATE | 5 |

### Phase 6 (Wiki = Code Graph)

| File | Action | Phase |
|---|---|---|
| `backend/app/services/wiki_freshness.py` | CREATE | 6 |
| `backend/app/argon/ai/mrp/mapper.py` | MODIFY | 6 |
| `backend/app/api/routes/v1/argon_codegraph.py` | CREATE | 6 |

### Phase 7 (Skills)

| File | Action | Phase |
|---|---|---|
| `skills/argon-query/SKILL.md` | COPY | 7.1 |
| `skills/argon-edit/SKILL.md` | COPY | 7.1 |
| `skills/argon-review/SKILL.md` | COPY | 7.1 |
| `skills/codegraph-explore/SKILL.md` | CREATE | 7.1 |
| `CLAUDE.md` | MODIFY | 7.2 |
| `AGENTS.md` | MODIFY | 7.3 |

---

## 13. Database Schema Changes (Tóm tắt)

### Migration 0007 — Argon Schema

**Cần pgvector:** Chỉ create embedding tables nếu extension available.

**Tables mới (non-pgvector):** ~25 bảng (employees, departments, roles, wiki_pages, sources, skills, projects, audit_logs, notifications, etc.)

**Tables mới (cần pgvector):** 4 bảng (wiki_page_embedding_768/1024/1536/3072)

**Key concern:** Argon dùng `Employee` model với `user_id` FK → `users.id`. Migration sẽ:
1. Create `employees` table với `user_id FK → users.id`
2. Seed 1 employee record cho mỗi existing user
3. Đây là auto-create, không breaking

### Migration 0008 — Codegraph Metadata (Optional)

Lưu codegraph index status per workspace trong PostgreSQL (stats, last_synced, node_count). Actual graph data vẫn ở SQLite trong workspace directory.

---

## 14. Dependencies Cần Thêm

### Backend (backend/pyproject.toml)

Argon models.py dùng `pgvector.sqlalchemy` — đã có trong hiện tại qua chiron. Không cần thêm.

Argon services cần:
- `python-magic` — file type detection (kb_service.py)
- `pillow` — image extraction (image_service.py)
- `pymupdf` hoặc `pypdf2` — PDF parsing (kb_service.py)
- `python-docx` — DOCX parsing

Thêm vào `pyproject.toml`:
```toml
[project.dependencies]
python-magic = ">=0.4"
pillow = ">=10.0"
pymupdf = ">=1.23"
python-docx = ">=1.1"
```

### Frontend (frontend/package.json)

Thêm cho Wiki panel:
- `react-force-graph-2d` — graph visualization
- `diff` — diff parsing cho DiffViewer
- `react-markdown` + `remark-gfm` — markdown rendering
- `@monaco-editor/react` — wiki editor

---

## 15. Thứ tự Thực hiện (Recommended)

```
Week 1:
  Phase 0.1 — Git Diff Preview (2h) → CRITICAL, high value, standalone
  Phase 0.2 — Auto context injection (3h) → HIGH, immediately useful
  Phase 0.3 — Multi-workspace tabs (4h) → MEDIUM, UI work
  
Week 2:
  Phase 1   — Wire Argon backend (8h) → enables wiki + skills
  Phase 2.1 — Copy codegraph (1h)
  Phase 2.3 — Codegraph service (4h)
  
Week 3:
  Phase 3   — Wiki panel frontend (12h) → biggest UI work
  
Week 4:
  Phase 4   — Argorouter panel (5h)
  Phase 5   — Codegraph panel (5h)
  Phase 0.4 — Memory Brain (3h)
  Phase 0.5 — Tauri build fix (3h)
  
Week 5:
  Phase 6   — Wiki = Code Graph innovation (8h)
  Phase 7   — Skills merge (2h)
  Phase 11  — NavRail reorganization (3h)
```

---

## 16. Risks & Mitigations

| Risk | Khả năng | Mitigation |
|---|---|---|
| pgvector chưa installed | HIGH | Migration 0007 tự skip embedding tables. Semantic search fallback về full-text. |
| Argorouter (Node.js) conflict với Tauri PATH | MEDIUM | Dùng `cli_utils.py` binary discovery; hardcode path trong startup |
| Argon auth compat (User ↔ Employee) | MEDIUM | `auth_compat.py` đã exists, cần test kỹ user seeding |
| Codegraph index time trên large repos | MEDIUM | Background indexing, non-blocking. Show progress in UI. |
| Port conflicts (Argorouter 20128, Codegraph 202xx) | LOW | Configurable ports, port-scan before bind |
| Next.js → React port effort (Wiki UI) | HIGH | Không port 1:1. Chỉ port key components, dùng shadcn/ui approach với Tailwind nếu muốn, hoặc giữ inline styles như Argo hiện tại |
| MRP pipeline từ Argon vs Chiron MRP conflict | MEDIUM | Argon MRP chạy riêng dưới `/argon/` prefix. Chiron MRP vẫn dùng cho chiron sources. Dần migrate về Argon MRP. |

---

## 17. Acceptance Criteria

### Phase 0 Done When:
- [ ] Chat shows collapsible diff preview before Confirm button
- [ ] Chat automatically injects top wiki pages related to user query
- [ ] Can switch between 2+ open workspaces without data bleed
- [ ] Conversation summary auto-injected when resuming session
- [ ] `make build-tauri` produces working .app on macOS

### Phase 1 Done When:
- [ ] `GET /api/v1/argon/wiki/pages` returns 200
- [ ] `POST /api/v1/argon/sources` can upload a file
- [ ] Argon MCP server responds at `/argon/mcp`
- [ ] Migration 0007 runs without error (with or without pgvector)

### Phase 2 Done When:
- [ ] `codegraph/` directory exists in repo root
- [ ] Opening a workspace auto-starts codegraph MCP process
- [ ] `GET /api/v1/codegraph/{workspace_id}/status` returns node count
- [ ] Claude in chat can call `codegraph_context()`

### Phase 3 Done When:
- [ ] Wiki tab shows in NavRail
- [ ] Can browse wiki pages in 2-pane layout
- [ ] Can upload a document and see ingestion progress
- [ ] Can propose/approve/reject wiki drafts

### Phase 4 Done When:
- [ ] Argorouter panel shows provider connection status
- [ ] Can add a new provider connection from UI
- [ ] Usage stats chart renders

### Phase 5 Done When:
- [ ] Codegraph panel shows node count and indexed languages
- [ ] Symbol search returns results
- [ ] Graph visualization renders (even if simple)

### Phase 6 Done When:
- [ ] [Auto-generate Wiki] button creates wiki pages from codegraph
- [ ] Wiki pages show freshness score
- [ ] Stale pages (< 80% accuracy) show warning badge

---

## 18. Những gì KHÔNG làm (Out of Scope)

- **Full Next.js → React port:** Không rebuild toàn bộ Arkon frontend. Chỉ lấy key components.
- **Full RBAC implementation:** Argo là personal tool, chỉ cần simplified version (owner permissions only, no department scoping).
- **Re-embedding migration:** Không auto-migrate embeddings. User manually trigger nếu cần.
- **Cloud sync (Argorouter):** Không integrate cloud sync feature của 9router.
- **OAuth 2.1 PKCE:** Không implement Arkon's OAuth for MCP Desktop. Dùng simple bearer token.
- **Email/webhook notifications:** Argon's notification dispatch để sau.
- **Multi-user:** Argo là single-user desktop app. Argon's RBAC chỉ dùng ở mức schema, không enforce đầy đủ.

---

## 19. Evaluation: Có nên integrate không?

### Arkon → Argon

**Nên:** ✅
- MRP pipeline của Arkon **mature hơn** Chiron's pipeline (6 phases vs 5, có verifier, plan review, draft workflow)
- Multi-dimension embeddings (768/1024/1536/3072) vs Chiron's single 768d
- Skills framework cho phép distribute AI guides
- RBAC và audit logging khi scale lên multi-user
- Wiki với draft workflow và revision history — critical cho collaborative knowledge management
- Code đã được copy vào repo, chỉ cần wire

**Rủi ro:** ❗
- Scope lớn — 25+ new DB tables, 20+ API routes
- Auth compat cần test kỹ
- pgvector vẫn chưa installed → embedding features bị defer

**Verdict:** Integrate. Backend đã ready, chỉ cần wire + build frontend.

---

### 9router → Argorouter

**Nên:** ✅
- RTK compression saves 20-40% tokens → tiết kiệm Pro/Max quota đáng kể
- 40+ providers với auto-fallback → không bao giờ bị stuck vì rate limit
- Free tier providers (Kiro, Antigravity) → cost = $0 cho nhiều tasks
- Skills đã rename sang argorouter-*
- Runs as sidecar, zero code change trong Argo backend để start

**Rủi ro:** ❗
- Node.js process cần manage lifecycle (start/stop với Argo)
- PORT conflicts nếu user đã chạy 9router riêng
- Argorouter UI panel là separate effort (React port từ Next.js dashboard)

**Verdict:** Integrate. Đặc biệt giá trị cho RTK + fallback. Chạy như sidecar.

---

### Codegraph

**Nên:** ✅✅ (Strongest recommendation)
- **Core innovation** của Argo v2: AI hiểu codebase mà không cần scan files
- Giảm 35-70% tokens trong codebase exploration
- Framework route detection (Django, FastAPI, NestJS, etc.) cực kỳ giá trị
- 24 languages out of box
- Integrates trực tiếp vào Claude via MCP — không cần teach Claude cách dùng
- Kết hợp với Argon wiki tạo "self-documenting codebase" workflow

**Rủi ro:** ❗
- Index time trên large repos (VS Code ~10k files = vài phút)
- SQLite WAL mode cần test với concurrent reads
- Codegraph process management trong Tauri context (PATH issues)

**Verdict:** Integrate. Đây là differentiator lớn nhất. Priority cao nhất trong 3 integrations.

---

*Plan này sẵn sàng để review. Confirm để bắt đầu implement theo thứ tự đề xuất ở Section 15.*
