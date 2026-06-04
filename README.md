# AI Spec Generator — Multi-Agent Pipeline

Nhập mô tả dự án bằng tiếng Anh, nhận lại một đặc tả phần mềm hoàn chỉnh được tạo bởi **bốn AI agent chạy nối tiếp nhau**: Planner → Engineer → Cost Estimator → Writer, stream trực tiếp về giao diện React qua Server-Sent Events.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser — React + Vite (localhost:5001)                │
│  Sidebar History │ Input Form │ Agent Cards │ Spec Out  │
└────────────────────────┬────────────────────────────────┘
                         │  POST /api/v1/pipeline/run
                         │  ← SSE stream (newline-delimited JSON)
┌────────────────────────▼────────────────────────────────┐
│  FastAPI Backend (localhost:8000)                        │
│                                                         │
│  Token Compression → RAG Context inject                 │
│                                                         │
│  1. Planner Agent       → phases JSON                   │
│  2. Engineer Agent      → tech stack + arch JSON        │
│     └─ DuckDuckGo web search before LLM call            │
│  3. Cost Estimator      → budget + breakdown JSON       │
│  4. Writer Agent        → Markdown spec string          │
│                                                         │
│  Model Routing (per agent):                             │
│    Anthropic key set?  → Planner/Cost via claude-sonnet │
│    No Anthropic key    → all agents → Ollama            │
│    Ollama unavailable  → fall back to Anthropic         │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
   PostgreSQL :5433               Redis :6379
   (RAG documents,               (Celery broker,
    sync sources)                 result backend)
```

## Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, PydanticAI, asyncpg |
| AI — Cloud | `claude-sonnet-4-6` (reasoning), `claude-haiku-4-5` (fast) |
| AI — Local | Ollama `gemma4:31b-cloud` (no API key needed) |
| Web Search | DuckDuckGo (no API key) |
| RAG Memory | PostgreSQL FTS (`to_tsvector` / `to_tsquery`) |
| Background Jobs | Celery + Redis (RAG auto-sync every 20 min) |
| Streaming | Server-Sent Events (SSE) |
| Frontend | React 18, Vite 8, Tailwind CSS v4 |

---

## Khởi chạy nhanh (không cần Anthropic API key)

Cách đơn giản nhất: chạy mọi thứ locally với Ollama.

### Yêu cầu

- Python ≥ 3.12 với [uv](https://docs.astral.sh/uv/)
- Node.js ≥ 18
- PostgreSQL 16 (Homebrew hoặc Docker)
- Redis 7 (Homebrew hoặc Docker)
- [Ollama](https://ollama.com) (để chạy không cần API key)

### 1. Clone & cài backend

```bash
git clone <repo-url>
cd ai_multi_agent/backend

# Cài dependencies
uv sync

# Copy file env
cp .env .env.local   # hoặc chỉnh sửa .env trực tiếp
```

### 2. Cấu hình `.env`

Mở `backend/.env` và kiểm tra các giá trị sau:

```env
# Postgres — điều chỉnh theo cài đặt local của bạn
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=ai_multi_agent

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Ollama (không cần API key — model chạy local)
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=gemma4:31b-cloud

# Anthropic (tuỳ chọn — bỏ trống thì tất cả agent dùng Ollama)
ANTHROPIC_API_KEY=

# Model routing
AI_REASONING_MODEL=claude-sonnet-4-6
AI_FAST_MODEL=claude-haiku-4-5
```

> **Không có Anthropic API key?** Không sao — khi `ANTHROPIC_API_KEY` trống, toàn bộ pipeline tự động chuyển sang Ollama.

### 3. Khởi động PostgreSQL & Redis

**Bằng Homebrew (macOS):**

```bash
brew services start postgresql@16
brew services start redis
```

**Bằng Docker:**

```bash
docker compose up -d db redis
```

### 4. Chạy migration database

```bash
cd backend
uv run alembic upgrade head
```

### 5. Pull model Ollama

```bash
ollama pull gemma4:31b-cloud
```

> Nếu muốn model nhẹ hơn để test nhanh: `ollama pull qwen2.5:7b-instruct`

### 6. Khởi động backend

```bash
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

API chạy tại `http://localhost:8000`  
Docs: `http://localhost:8000/docs`

### 7. Khởi động frontend

```bash
cd frontend
npm install
npm run dev
```

Vite khởi động tại **http://localhost:5001** và tự proxy `/api` sang `localhost:8000`.

---

## Khởi chạy với Anthropic API key

Nếu có API key, Planner và Cost Estimator sẽ dùng `claude-sonnet-4-6` (chính xác hơn cho JSON có cấu trúc), trong khi Engineer và Writer vẫn dùng Ollama.

```env
ANTHROPIC_API_KEY=sk-ant-api03-...
AI_REASONING_MODEL=claude-sonnet-4-6
AI_FAST_MODEL=claude-haiku-4-5
```

Routing tự động — không cần thay đổi code.

---

## Khởi chạy bằng Docker (full stack)

```bash
# Build & start tất cả services (backend, db, redis, celery)
docker compose up -d

# Chạy migration
docker compose exec app uv run alembic upgrade head
```

Truy cập:
- Backend API: http://localhost:8007
- Flower (Celery monitor): http://localhost:5555

---

## Cách dùng

1. Mở **http://localhost:5001**
2. Nhập mô tả dự án vào ô input (hoặc click gợi ý bên dưới)
3. Nhấn **Generate →** (hoặc `Cmd+Enter`)
4. Xem bốn agent chạy lần lượt — mỗi card mở rộng khi có kết quả
5. Đọc đặc tả Markdown hoàn chỉnh — nhấn **Copy** để sao chép

---

## SSE Event Format

```
data: {"type": "pipeline_init", "tokens_before": 42, "tokens_after": 38, "rag_chunks": 2, "compression_enabled": true}

data: {"type": "agent_start",  "agent": "planner",  "provider": "ollama"}
data: {"type": "agent_done",   "agent": "planner",  "result": {"phases": [...]}}

data: {"type": "agent_start",  "agent": "engineer", "provider": "ollama"}
data: {"type": "agent_done",   "agent": "engineer", "result": {"techStack": [...], "architecture": "...", "keyDecisions": [...]}}

data: {"type": "agent_start",  "agent": "cost_estimator", "provider": "ollama"}
data: {"type": "agent_done",   "agent": "cost_estimator", "result": {"low": 15000, "high": 21000, "currency": "USD", "breakdown": [...]}}

data: {"type": "agent_start",  "agent": "writer", "provider": "ollama"}
data: {"type": "agent_done",   "agent": "writer", "result": {"preview": "# Project Spec..."}}

data: {"type": "complete", "spec": "# Project Specification: ...(full Markdown)"}
```

---

## Project Structure

```
ai_multi_agent/
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── pipeline/
│   │   │   │   ├── planner.py        # Phase planning agent
│   │   │   │   ├── engineer.py       # Architecture agent (+ web search)
│   │   │   │   ├── cost_estimator.py # Budget agent
│   │   │   │   ├── writer.py         # Spec writer agent
│   │   │   │   ├── runner.py         # SSE pipeline orchestrator
│   │   │   │   └── model_router.py   # Per-agent LLM selection + fallback
│   │   │   └── tools/
│   │   │       ├── token_compression.py  # HTML strip, URL shorten, whitespace
│   │   │       └── web_search.py         # DuckDuckGo async wrapper
│   │   ├── api/routes/v1/
│   │   │   └── pipeline.py           # POST /api/v1/pipeline/run
│   │   ├── db/models/
│   │   │   ├── rag_document.py       # RAG chunk storage
│   │   │   └── sync_source.py        # Configured data sources
│   │   ├── repositories/
│   │   │   ├── rag_document.py       # PostgreSQL FTS search
│   │   │   └── sync_source.py
│   │   ├── services/
│   │   │   ├── rag_document.py       # Text chunking + retrieval
│   │   │   └── rag_sync.py           # URL / GitHub README fetch & index
│   │   └── worker/tasks/
│   │       └── rag_tasks.py          # Celery beat: sync every 20 min
│   ├── alembic/versions/
│   │   └── 0001_initial_schema.py    # Full initial migration
│   └── .env                          # Local config (not committed)
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── AgentCard.jsx         # Per-agent status + result card
│       │   ├── InputForm.jsx         # Pill input with ChatGPT-style UX
│       │   ├── Sidebar.jsx           # Run history (localStorage)
│       │   └── SpecOutput.jsx        # Rendered Markdown + copy button
│       ├── hooks/
│       │   └── usePipeline.js        # SSE streaming + state management
│       └── App.jsx
├── docker-compose.yml                # Full stack (backend + db + redis + celery)
└── Makefile                          # Dev shortcuts
```

---

## Makefile shortcuts

```bash
make install       # uv sync + pre-commit install
make format        # ruff format + ruff check --fix
make lint          # ruff check + ty check
make test          # pytest
make test-cov      # pytest + html coverage report
```

---

## Troubleshooting

**`RuntimeError: No ANTHROPIC_API_KEY and Ollama unreachable`**  
→ Đảm bảo Ollama đang chạy: `ollama serve` hoặc mở Ollama app.

**Port 5000 bị chiếm (macOS AirPlay)**  
→ Frontend đã cấu hình port 5001. Nếu 5001 cũng bị chiếm, Vite tự tăng lên 5002.

**`alembic upgrade head` lỗi kết nối**  
→ Kiểm tra `POSTGRES_HOST` và `POSTGRES_PORT` trong `.env`. Homebrew PostgreSQL mặc định port 5432 (không phải 5433).

**DuckDuckGo search trả về rỗng**  
→ DuckDuckGo rate-limit theo IP. Thử lại sau vài giây — pipeline vẫn chạy bình thường, engineer sẽ bỏ qua phần search context.
