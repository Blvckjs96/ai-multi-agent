# Chiron Knowledge Engine — Hướng dẫn cài đặt & Workflow

Chiron là hệ thống knowledge base thông minh của Argo, tích hợp vào Claude CLI như một MCP server. Tài liệu này mô tả cách cài đặt, cấu hình, và sử dụng Chiron từ đầu đến cuối.

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Yêu cầu hệ thống](#2-yêu-cầu-hệ-thống)
3. [Cài đặt từng bước](#3-cài-đặt-từng-bước)
4. [Cấu hình .env](#4-cấu-hình-env)
5. [Khởi động services](#5-khởi-động-services)
6. [Workflow: Ingest → Review → Commit](#6-workflow-ingest--review--commit)
7. [Cấu hình embedding model](#7-cấu-hình-embedding-model)
8. [Cấu hình MinIO (production)](#8-cấu-hình-minio-production)
9. [Chiron MCP trong Claude CLI](#9-chiron-mcp-trong-claude-cli)
10. [API Reference](#10-api-reference)
11. [Triển khai Docker](#11-triển-khai-docker)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────────────────┐
│                        Claude CLI                            │
│                    (+ Chiron MCP server)                     │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP / streamable-http
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   FastAPI Backend (uvicorn)                   │
│                                                              │
│  /api/v1/chiron/...          ← REST API                      │
│  /chiron/mcp                 ← MCP endpoint cho Claude       │
│  /api/v1/chiron/providers/.. ← Provider management          │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
    ┌──────────▼──────────┐      ┌─────────────▼─────────────┐
    │   PostgreSQL         │      │         Redis              │
    │  + pgvector (768d)   │      │  (arq job queue "chiron")  │
    └──────────────────────┘      └─────────────┬─────────────┘
                                               │
                                  ┌────────────▼────────────┐
                                  │    arq Worker Process    │
                                  │  (MRP pipeline + embed)  │
                                  └─────────────────────────┘
```

### Luồng xử lý tài liệu

```
Upload file / JSON ingest
        │
        ▼
  ChironSource (DB)     ← minio_key lưu path trên MinIO
        │
        ▼ arq enqueue
  ┌─────────────────────────────────────────────────────┐
  │               MRP Pipeline (arq worker)              │
  │                                                      │
  │  TRIAGE  → phân loại loại tài liệu                  │
  │  MAP     → extract semantic chunks                   │
  │  REDUCE  → tổng hợp thành wiki page proposals        │
  │  REFINE  → polish nội dung                           │
  │  VERIFY  → tạo ChironWikiDraft (PENDING)             │
  └──────────────────────┬───────────────────────────────┘
                         │ human review qua API
              ┌──────────┴──────────┐
              │ approve             │ reject
              ▼                     ▼
       COMMIT phase          Plan REJECTED
    ChironWikiPage                 │
    (upsert/create)                └─ drafts marked REJECTED
              │
              ▼ arq enqueue
    embed_page_task
    (Ollama nomic-embed-text → pgvector)
```

---

## 2. Yêu cầu hệ thống

| Thành phần | Phiên bản tối thiểu | Ghi chú |
|-----------|-------------------|---------|
| Python | 3.12+ | Dùng `uv` để quản lý |
| PostgreSQL | 15+ | Cần extension `vector` |
| Redis | 6+ | Làm queue cho arq |
| Ollama | latest | Chạy embedding model |
| MinIO | RELEASE.2024+ | Tùy chọn — local storage làm fallback |

### RAM khuyến nghị

| Model embedding | RAM tối thiểu |
|----------------|--------------|
| `nomic-embed-text` (768d, 274 MB) | 4 GB |
| `mxbai-embed-large` (1024d, 670 MB) | 8 GB |
| `all-minilm` (384d, 45 MB) | 2 GB |

---

## 3. Cài đặt từng bước

### Bước 1: Clone và cài dependencies

```bash
git clone <repo-url>
cd ai_multi_agent

# Cài Python dependencies (backend)
cd backend
uv sync
```

### Bước 2: Cài PostgreSQL với pgvector

```bash
# macOS (Homebrew)
brew install postgresql@15
brew services start postgresql@15

# Cài pgvector extension
brew install pgvector

# Tạo database
psql -U postgres -c "CREATE DATABASE ai_multi_agent;"
psql -U postgres -d ai_multi_agent -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

```bash
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE DATABASE ai_multi_agent;"

# Cài pgvector
sudo apt install postgresql-15-pgvector
sudo -u postgres psql -d ai_multi_agent -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Bước 3: Cài Redis

```bash
# macOS
brew install redis
brew services start redis

# Ubuntu
sudo apt install redis-server
sudo systemctl start redis
```

### Bước 4: Cài và cấu hình Ollama

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Pull embedding model (bắt buộc cho vector search)
ollama pull nomic-embed-text

# Kiểm tra Ollama đang chạy
curl http://localhost:11434/api/tags
```

### Bước 5: Cài MinIO (tùy chọn)

Nếu không cài MinIO, system tự động dùng local filesystem (`./media/`).

```bash
# macOS
brew install minio/stable/minio
mkdir -p ~/minio/data
minio server ~/minio/data --console-address ":9001"

# Docker (đơn giản hơn)
docker run -d \
  -p 9000:9000 -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  --name minio \
  minio/minio server /data --console-address ":9001"
```

MinIO Console: http://localhost:9001 (user: `minioadmin`, pass: `minioadmin`)

---

## 4. Cấu hình .env

```bash
cd backend
cp .env.example .env
```

Chỉnh sửa `.env`:

```env
# === Database ===
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=ai_multi_agent

# === Redis ===
REDIS_HOST=localhost
REDIS_PORT=6379

# === AI Agent ===
ANTHROPIC_API_KEY=sk-ant-...         # Bắt buộc cho MRP pipeline

# === Ollama (embedding — miễn phí, local) ===
OLLAMA_HOST=http://localhost:11434
CHIRON_EMBEDDING_MODEL=nomic-embed-text   # Phải khớp với model đã pull

# === MinIO (tùy chọn) ===
# Để trống MINIO_ACCESS_KEY để dùng local storage
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_CHIRON=chiron-sources
MINIO_SECURE=false

# === Chiron MCP ===
CHIRON_MCP_BASE_URL=http://localhost:8000
```

---

## 5. Khởi động services

Cần **3 terminal** khi phát triển local:

### Terminal 1 — FastAPI server

```bash
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

### Terminal 2 — arq worker (Chiron MRP pipeline + embedding)

```bash
cd backend
uv run arq app.worker.arq_worker.WorkerSettings
```

Worker này xử lý:
- `ingest_mrp_task` — chạy TRIAGE→MAP→REDUCE→REFINE→VERIFY
- `commit_plan_task` — áp dụng approved pages vào wiki
- `embed_page_task` — tạo vector embedding qua Ollama

### Terminal 3 — Database migrations (chỉ cần chạy 1 lần)

```bash
cd backend
uv run alembic upgrade head
```

### Kiểm tra health

```bash
# API health
curl http://localhost:8000/health

# Chiron provider hardware detection
curl -H "X-API-Key: change-me-in-production" \
  http://localhost:8000/api/v1/chiron/providers/hardware
```

---

## 6. Workflow: Ingest → Review → Commit

### Bước 1: Ingest tài liệu

**Qua file upload (khuyến nghị):**
```bash
curl -X POST \
  -H "X-API-Key: YOUR_API_KEY" \
  -F "file=@/path/to/document.md" \
  "http://localhost:8000/api/v1/chiron/{workspace_id}/upload"
```

**Qua JSON body:**
```bash
curl -X POST \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "docs/architecture.md",
    "content": "# Architecture\n\nThis document describes...",
    "mime_type": "text/plain"
  }' \
  "http://localhost:8000/api/v1/chiron/{workspace_id}/ingest"
```

Response:
```json
{
  "id": "3f4a...",
  "workspace_id": "...",
  "file_path": "architecture.md",
  "status": "pending",
  "mime_type": "text/markdown",
  "minio_key": "{workspace_id}/abc123_architecture.md"
}
```

arq worker sẽ tự động pick up job và chạy MRP pipeline trong nền.

### Bước 2: Theo dõi tiến trình

```bash
# List compilation plans
curl -H "X-API-Key: YOUR_API_KEY" \
  "http://localhost:8000/api/v1/chiron/{workspace_id}/plans"

# Chi tiết plan (xem proposed_pages)
curl -H "X-API-Key: YOUR_API_KEY" \
  "http://localhost:8000/api/v1/chiron/{workspace_id}/plans/{plan_id}"
```

Plan status flow:
```
pending → running → waiting_review → approved/rejected → done
```

### Bước 3: Review và approve/reject

```bash
# Approve plan (enqueues COMMIT task)
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:8000/api/v1/chiron/{workspace_id}/plans/{plan_id}/approve"

# Reject plan
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Content needs revision"}' \
  "http://localhost:8000/api/v1/chiron/{workspace_id}/plans/{plan_id}/reject"
```

### Bước 4: Tìm kiếm sau khi commit

```bash
curl -X POST \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "how does authentication work?", "top_k": 5}' \
  "http://localhost:8000/api/v1/chiron/{workspace_id}/search"
```

Search tự động: **vector search (Ollama pgvector)** → fallback **TF-IDF** nếu Ollama không available.

---

## 7. Cấu hình embedding model

Sprint F cung cấp API để xem và chuyển đổi embedding model tại runtime, không cần restart server.

### Xem hardware hiện tại

```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  "http://localhost:8000/api/v1/chiron/providers/hardware"
```

```json
{
  "ram_gb": 16.0,
  "cpu_cores": 8,
  "platform": "darwin",
  "arch": "arm64",
  "has_apple_silicon": true,
  "gpus": [{"name": "Apple Silicon GPU", "vram_gb": 16.0, "backend": "apple_mps"}]
}
```

### Xem model catalog + recommendations

```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  "http://localhost:8000/api/v1/chiron/providers/embedding/models"
```

Response:
```json
{
  "active_model": "nomic-embed-text",
  "schema_dim": 768,
  "hardware": {"ram_gb": 16.0, "has_apple_silicon": true, "gpu_vram_gb": 16.0},
  "models": [
    {
      "id": "nomic-embed-text",
      "tier": "recommended",
      "is_installed": true,
      "schema_compatible": true,
      "quality_score": 8,
      "size_gb": 0.27,
      "dim": 768
    },
    {
      "id": "mxbai-embed-large",
      "tier": "needs_migration",
      "schema_compatible": false,
      "dim": 1024
    }
  ]
}
```

**Tier meanings:**
- `recommended` — fits RAM + compatible với schema (768d) → có thể chọn ngay
- `needs_migration` — dimension khác 768d → cần chạy migration trước
- `insufficient_ram` — RAM không đủ

### Chuyển đổi model (cùng dimension)

```bash
# Pull model trước nếu chưa có
ollama pull snowflake-arctic-embed:m

# Switch
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model_id": "snowflake-arctic-embed:m"}' \
  "http://localhost:8000/api/v1/chiron/providers/embedding/select"
```

Model được lưu vào `ChironConfig` DB và có hiệu lực ngay (không cần restart).

### Chuyển sang model dimension khác (cần migration)

```bash
# 1. Tạo migration mới
uv run alembic revision -m "change_embedding_dim_to_1024"
# Sửa migration: drop + recreate chiron_page_embeddings với vector(1024)

# 2. Apply migration
uv run alembic upgrade head

# 3. Pull model
ollama pull mxbai-embed-large

# 4. Switch với force=true
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model_id": "mxbai-embed-large", "force": true}' \
  "http://localhost:8000/api/v1/chiron/providers/embedding/select"

# 5. Re-embed tất cả pages (mỗi page embed lại từ đầu)
# Chạy embed_page_task cho từng page hoặc dùng bulk re-embed command
```

---

## 8. Cấu hình MinIO (production)

### Tạo bucket và access key

1. Mở MinIO Console: http://localhost:9001
2. Vào **Access Keys** → **Create Access Key**
3. Copy Access Key và Secret Key vào `.env`

```env
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=<access-key-from-console>
MINIO_SECRET_KEY=<secret-key-from-console>
MINIO_BUCKET_CHIRON=chiron-sources
MINIO_SECURE=false
```

Bucket `chiron-sources` được tạo tự động khi app khởi động.

### Presigned download URL

```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  "http://localhost:8000/api/v1/chiron/{workspace_id}/sources/{source_id}/download"
```

```json
{
  "storage_key": "{workspace_id}/abc123_document.md",
  "presigned_url": "http://localhost:9000/chiron-sources/...?X-Amz-Expires=3600&..."
}
```

URL có hiệu lực trong 1 giờ (mặc định).

---

## 9. Chiron MCP trong Claude CLI

Chiron expose MCP tools để Claude có thể trực tiếp đọc/ghi wiki trong mọi conversation.

### Cấu hình MCP

Thêm vào `~/.claude/settings.json` hoặc dùng `claude config`:

```json
{
  "mcpServers": {
    "chiron": {
      "type": "http",
      "url": "http://localhost:8000/chiron/mcp"
    }
  }
}
```

### Tools available

| Tool | Mô tả |
|------|-------|
| `search_wiki` | Tìm kiếm pages theo semantic query |
| `get_wiki_page` | Đọc nội dung đầy đủ một page |
| `propose_wiki_edit` | Đề xuất thay đổi (tạo ChironWikiDraft) |
| `list_pending_drafts` | Xem danh sách drafts chờ review |
| `approve_draft` | Approve và apply draft |
| `reject_draft` | Reject draft với lý do |

### Ví dụ trong Claude session

```
Claude sẽ tự động gọi:
- search_wiki("authentication flow") trước khi trả lời câu hỏi về auth
- propose_wiki_edit(...) khi phát hiện thông tin mới cần cập nhật
```

---

## 10. API Reference

### Chiron Sources

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `POST` | `/chiron/{ws}/ingest` | Ingest qua JSON body |
| `POST` | `/chiron/{ws}/upload` | Ingest qua file upload |
| `GET` | `/chiron/{ws}/sources` | List sources |
| `GET` | `/chiron/{ws}/sources/{id}/download` | Presigned download URL |

### Chiron Wiki Pages

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/chiron/{ws}/pages` | List wiki pages |
| `GET` | `/chiron/{ws}/pages/{id}` | Get page detail |
| `DELETE` | `/chiron/{ws}/pages/{id}` | Delete page |
| `POST` | `/chiron/{ws}/search` | Semantic search |

### Compilation Plans

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/chiron/{ws}/plans` | List plans |
| `GET` | `/chiron/{ws}/plans/{id}` | Plan detail + proposed_pages |
| `POST` | `/chiron/{ws}/plans/{id}/approve` | Approve → COMMIT |
| `POST` | `/chiron/{ws}/plans/{id}/reject` | Reject plan |

### Provider Management

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/chiron/providers/hardware` | Hardware detection |
| `GET` | `/chiron/providers/embedding/models` | Model catalog + recommendations |
| `GET` | `/chiron/providers/embedding/current` | Current active model |
| `POST` | `/chiron/providers/embedding/select` | Switch model (JWT required) |

### Auth

- **API Key**: Header `X-API-Key: <key>` — dùng cho service-to-service
- **JWT Bearer**: Header `Authorization: Bearer <token>` — dùng cho user actions (approve/reject/select model)

---

## 11. Triển khai Docker

```yaml
# docker-compose.yml (thêm vào services)

chiron-worker:
  build: ./backend
  command: uv run arq app.worker.arq_worker.WorkerSettings
  depends_on:
    - postgres
    - redis
  env_file: .env
  restart: unless-stopped

minio:
  image: minio/minio
  command: server /data --console-address ":9001"
  ports:
    - "9000:9000"
    - "9001:9001"
  environment:
    MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
    MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
  volumes:
    - minio_data:/data
  restart: unless-stopped

ollama:
  image: ollama/ollama
  ports:
    - "11434:11434"
  volumes:
    - ollama_data:/root/.ollama
  restart: unless-stopped
  # GPU support (NVIDIA):
  # deploy:
  #   resources:
  #     reservations:
  #       devices:
  #         - driver: nvidia
  #           count: all
  #           capabilities: [gpu]

volumes:
  minio_data:
  ollama_data:
```

Sau khi `docker compose up -d`, pull model:

```bash
docker exec -it <ollama-container> ollama pull nomic-embed-text
```

---

## 12. Troubleshooting

### arq worker không nhận job

```bash
# Kiểm tra Redis kết nối
redis-cli ping  # → PONG

# Kiểm tra queue
redis-cli llen arq:queue:chiron

# Xem log worker
uv run arq app.worker.arq_worker.WorkerSettings --verbose
```

### Vector search không hoạt động (fallback về TF-IDF)

```bash
# 1. Kiểm tra Ollama
curl http://localhost:11434/api/tags

# 2. Kiểm tra model đã pull chưa
ollama list

# 3. Kiểm tra model trong API
curl -H "X-API-Key: ..." http://localhost:8000/api/v1/chiron/providers/embedding/current

# 4. Test embedding trực tiếp
curl http://localhost:11434/api/embeddings \
  -d '{"model": "nomic-embed-text", "prompt": "test"}'
```

### pgvector extension lỗi

```bash
# Kiểm tra extension đã cài
psql -U postgres -d ai_multi_agent -c "\dx"

# Cài lại nếu cần
psql -U postgres -d ai_multi_agent -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Chạy lại migration
uv run alembic upgrade head
```

### MinIO connection refused

```bash
# Kiểm tra MinIO đang chạy
curl http://localhost:9000/minio/health/live

# Nếu dùng local storage thay thế
# Bỏ MINIO_ACCESS_KEY trong .env, system tự dùng ./media/
```

### MRP pipeline bị WAITING_REVIEW mãi

Plan cần được approve thủ công qua API hoặc frontend. Đây là thiết kế có chủ đích — human review gate.

```bash
# List plans chờ review
curl -H "X-API-Key: ..." \
  "http://localhost:8000/api/v1/chiron/{ws}/plans?limit=10"

# Approve
curl -X POST -H "Authorization: Bearer ..." \
  "http://localhost:8000/api/v1/chiron/{ws}/plans/{id}/approve"
```

---

*Chiron Knowledge Engine — Sprint A–F complete. Xem AGENTS.md để biết roadmap tiếp theo.*
