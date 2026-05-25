# Argo — Personal AI Workspace
> Desktop app (Tauri 2) powered by Claude Code CLI
> Last updated: 2026-05-15 | Status: Research & Planning

---

## Naming

| Name | Role |
|---|---|
| **Argo** | The desktop app — personal AI workspace (Jason's ship) |
| **Chiron** | The knowledge engine — compiled wiki + MRP pipeline (the wise teacher) |

---

## Vision

**Argo** is a personal AI workspace desktop app. It wraps Claude Code CLI in a premium UI, manages multiple repos simultaneously, remembers everything about the user across sessions, confirms before acting, and tracks every AI-caused change. The **Chiron** knowledge engine compiles uploaded documents into a persistent interlinked wiki that Claude reads via MCP tools. Primary execution engine: **Claude Code CLI** (uses Pro/Max subscription, not API credits).

---

## Architecture Overview (Target State)

```
┌──────────────────────────────────────────────────────────────────────┐
│                    ARGO — Tauri 2 Desktop App                        │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Workspace tabs: [ai_multi_agent ●] [my-blog ○] [+ Add repo]  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  View toggle: [💬 Chat] [>_ Terminal]                        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────────┐  ┌────────────────────┐  ┌──────────────────┐    │
│  │  Kanban Board│  │  Chat Bubbles View  │  │  Terminal View   │    │
│  │  (tasks)     │  │  (default)          │  │  (power users)   │    │
│  └──────────────┘  └────────────────────┘  └──────────────────┘    │
│                                                                      │
│  ┌─────────────────┐  ┌────────────────┐  ┌──────────────────┐     │
│  │  Change Timeline│  │  Chiron Wiki   │  │  GitHub Panel    │     │
│  │  (per workspace)│  │  (knowledge)   │  │  (OAuth)         │     │
│  └─────────────────┘  └────────────────┘  └──────────────────┘     │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ WebSocket / SSE / HTTP (Tauri → FastAPI)
┌───────────────────────────────▼──────────────────────────────────────┐
│                      FastAPI Backend (Argo API)                      │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                 WORKSPACE MANAGER                             │   │
│  │  Each workspace = one git repo, isolated:                     │   │
│  │  • own Claude CLI subprocess  • own change_log               │   │
│  │  • own Chiron knowledge scope • own active sessions           │   │
│  └────────────────────────────┬─────────────────────────────────┘   │
│                               ↓                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    TASK TRIAGE (pre-routing)                  │   │
│  │  Layer 1: Keyword rules (0ms, free)                           │   │
│  │  Layer 2: Skill semantic search (50ms, free)                  │   │
│  │  Layer 3: Haiku/Gemma4 classifier (300ms, cheap)              │   │
│  │  Output: allowed_tools + mcps + skills + effort_level         │   │
│  └────────────────────────────┬─────────────────────────────────┘   │
│                               ↓                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    HYBRID ROUTER                              │   │
│  │  Modes: auto | prefer_local | prefer_cloud |                  │   │
│  │         force_local | force_cloud                             │   │
│  │                                                               │   │
│  │  claude_cli  →  Claude Code CLI (Pro/Max subscription)        │   │
│  │  anthropic   →  Anthropic API (Sonnet/Haiku)                  │   │
│  │  ollama      →  Local Ollama (Gemma4)                         │   │
│  └──────┬────────────────┬──────────────────┬────────────────────┘   │
│         ↓                ↓                  ↓                        │
│   Claude Code CLI    Anthropic API      Ollama                       │
│   (subprocess pipe)  (PydanticAI)       (PydanticAI)                 │
│                                                                      │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐  │
│  │ Confirmation│ │ Memory Brain │ │ Change Log   │ │ Task Board │  │
│  │ (plan mode) │ │ (3-tier)     │ │ (per ws)     │ │ (Kanban)   │  │
│  └─────────────┘ └──────────────┘ └──────────────┘ └────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                  CHIRON — Knowledge Engine                     │ │
│  │  MRP Pipeline: MAP → REDUCE → REVIEW → REFINE → VERIFY → COMMIT│ │
│  │  MCP Server (/chiron/mcp) → 25+ tools for Claude to read wiki  │ │
│  │  Scopes: Global (all workspaces) + Workspace-specific          │ │
│  └────────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
            ┌────────────────┴──────────────────────────┐
            │    PostgreSQL + pgvector + Redis + MinIO   │
            │  workspaces | memories | change_log        │
            │  chiron_sources | chiron_wiki_pages        │
            │  conversations | tasks | oauth_tokens      │
            └───────────────────────────────────────────┘
```

---

## Workspace Architecture (Multi-Repo)

### Concept

Một **Workspace** = một git repo. Argo có thể mở nhiều workspace đồng thời — giống tabs trong browser. Mỗi workspace hoàn toàn độc lập với nhau.

```
[ai_multi_agent ●]  [my-blog ○]  [api-service ○]  [+ Add repo]
      ↑ active           ↑ idle        ↑ idle
```

### Tính isolation

| Thành phần | Isolation level | Lý do |
|---|---|---|
| Claude CLI subprocess | Per workspace | Mỗi repo có working directory khác nhau |
| Session ID (`--resume`) | Per workspace | Context của repo A không dùng cho repo B |
| Change log | Per workspace | Git history là per-repo |
| Git commits | Per workspace | `git` chạy trong từng repo path |
| Chiron knowledge | Per workspace (+ global layer) | Docs của repo A không liên quan repo B |
| Memory Tier 2 (user profile) | **Global** | "Thích snake_case" đúng ở mọi repo |
| Task board | Per workspace | Task gắn với một repo cụ thể |
| GitHub OAuth | Per workspace | Mỗi repo có remote riêng |

### Workspace model

```python
class Workspace(Base):
    __tablename__ = "workspaces"
    id: UUID
    user_id: UUID               # FK User
    name: str                   # "ai_multi_agent"
    repo_path: str              # "/Users/jason/Documents/ai_multi_agent"
    git_remote: str | None      # "https://github.com/user/repo"
    color: str                  # hex, auto-assigned for tab color
    is_active: bool             # currently open in UI
    last_opened_at: datetime
    created_at: datetime
```

Các bảng có `workspace_id`:
```
change_log.workspace_id          → FK Workspace
chiron_sources.workspace_id      → FK Workspace (None = global knowledge)
sessions.workspace_id            → FK Workspace
tasks.workspace_id               → FK Workspace
```

### Chiron knowledge scoping theo workspace

```
Khi Claude làm việc trong workspace "ai_multi_agent":
  Triage injects vào --append-system-prompt:
    1. Global Chiron wiki pages (áp dụng mọi nơi)
    2. Workspace-specific Chiron pages (chỉ của repo này)
    3. User profile (Tier 2 memory, global)

Khi mở repo mới lần đầu:
  → Chiron knowledge trống cho workspace đó
  → Chỉ có global knowledge + user profile
  → User có thể upload README/docs để Chiron compile
```

### Multi-repo parallel execution

```
Workspace A (active, streaming):
  Claude CLI PID 12345 → session-aaa
  Change log: commit abc123 in /path/to/repo-A
  Provider bar: ● claude-sonnet · streaming...

Workspace B (idle):
  Claude CLI PID 12346 → session-bbb (paused)
  Change log: 3 commits today in /path/to/repo-B
  Provider bar: ○ idle

Workspace C (running background task):
  Claude CLI PID 12347 → session-ccc
  Change log: 1 commit in /path/to/repo-C
  Provider bar: ● claude-haiku · running...
```

Workspace tab badge: số thông báo mới (commits, completed tasks).

---

## Claude Code CLI as Primary Execution Engine

### Why CLI over direct API

| Concern | Direct Anthropic API | Claude Code CLI |
|---|---|---|
| Billing | Needs API credits | Uses Pro/Max subscription |
| Models | Limited to key tier | Sonnet, Opus, Haiku — full |
| Tools | Self-implement | Bash, Read, Write, Search built-in |
| Session | Self-manage | `--resume session_id` built-in |
| Output | Raw stream | Structured `stream-json` events |
| Skills | Not available | 175 skills via `/skill-name` |
| MCP | Manual setup | Auto-loaded from config |

### Communication protocol

```bash
claude \
  --print \
  --output-format stream-json \   # structured JSON events
  --verbose \
  --include-partial-messages \    # streaming tokens (typing effect)
  --input-format stream-json \    # bidirectional streaming input
  --allowedTools "Read,Write,Edit,Bash,WebSearch" \   # from triage
  --strict-mcp-config \
  --mcp-config '{"servers": {"ux-kit": {...}}}' \     # from triage
  --permission-mode plan \        # confirmation phase
  --model sonnet \
  --resume <session_id>           # conversation continuity
```

### Stream-JSON event types

| Event | Frontend renders as |
|---|---|
| `system/init` | Session badge + model badge |
| `assistant` (text) | Chat bubble |
| `assistant` (thinking) | "Thinking..." spinner |
| `tool_use` | Collapsible card: "🔍 Searching..." |
| `tool_result` | Result inside card |
| `result` | Token bar + session ID (for resume) |
| `rate_limit_event` | Warning if near limit |

---

## Phase 1 — Hybrid Router + Claude CLI Provider
> **Goal:** Add `claude_cli` as a third provider alongside Anthropic API and Ollama
> **Effort:** ~1 week | **Risk:** Low | **Value:** Unlocks full Claude without API credits

### Provider model

```python
class Provider(StrEnum):
    ANTHROPIC  = "anthropic"    # direct API, needs credits
    OLLAMA     = "ollama"       # local, always free
    CLAUDE_CLI = "claude_cli"   # subprocess, uses Pro/Max subscription
```

### Routing decision tree

```
Input: task, routing_mode
        ↓
  force_local?      → Ollama only
  force_cloud?      → Anthropic API only
  prefer_local?     → Ollama if up, else Claude CLI
  prefer_cloud?     → Claude CLI if available, else Anthropic API
  auto:
    No ANTHROPIC_API_KEY AND claude CLI available → Claude CLI
    TaskType=REASONING                            → Claude CLI (Sonnet)
    TaskType=FAST + low complexity                → Ollama (Gemma4)
    Ollama down                                   → Claude CLI fallback
        ↓
Return: RoutingDecision(provider, model, was_fallback, reason)
```

### New files
```
M  backend/app/agents/pipeline/model_router.py   (add CLAUDE_CLI provider)
M  backend/app/core/config.py                    (ROUTING_MODE, TTL settings)
A  backend/app/services/claude_cli.py            (subprocess manager)
A  backend/app/api/routes/v1/providers.py        (status + mode endpoint)
A  frontend/src/components/ProviderStatusBar.jsx
```

### claude_cli.py — subprocess manager

```python
class ClaudeCliSession:
    session_id: str | None      # for --resume
    process: asyncio.subprocess.Process
    
    async def send(self, message: str) -> AsyncIterator[CLIEvent]:
        """Write to stdin, yield parsed stream-json events."""
    
    async def start(self, triage: TriageResult,
                    permission_mode: str = "plan") -> str:
        """Spawn claude subprocess, return session_id."""
    
    async def resume(self, session_id: str,
                     triage: TriageResult) -> None:
        """Reattach to existing Claude session."""
```

---

## Phase 2 — Task Triage (MCP/Skill Auto-Selection)
> **Goal:** Automatically pick the right tools, MCPs, and skills for each task
> **Effort:** ~1 week | **Risk:** Low | **Value:** High (saves 60-70% tokens + better accuracy)

### Token math: triage SAVES tokens

```
Without triage: 68 tools loaded × ~150 tokens = ~10,200 system prompt tokens
With triage:     6 tools loaded × ~150 tokens =    ~900 system prompt tokens
                 + triage call (Haiku):            +  400 tokens
                 Net saving per request:           ~8,900 tokens (-87%)
```

Layer 1 (keyword) and Layer 2 (semantic) are completely free — no LLM call needed.

### Three-layer architecture

```python
class TaskTriageService:

    async def analyze(self, message: str) -> TriageResult:
        # Layer 1: keyword rules — instant, free
        result = self._keyword_match(message)
        if result.confidence >= 0.8:
            return result

        # Layer 2: skill semantic search — ~50ms, free
        skill_matches = await self._skill_search(message, top_k=3)

        # Layer 3: LLM classifier — ~300ms, Haiku/Gemma4
        if result.confidence < 0.5:
            result = await self._llm_triage(message)

        return self._merge(result, skill_matches)

    def build_claude_command(self, triage: TriageResult,
                             session_id: str | None,
                             permission_mode: str) -> list[str]:
        cmd = [
            "claude", "--print",
            "--output-format", "stream-json",
            "--verbose", "--include-partial-messages",
            "--allowedTools", ",".join(triage.allowed_tools),
            "--model", triage.model,
            "--effort", triage.effort,
            "--permission-mode", permission_mode,
        ]
        if triage.mcp_servers:
            cmd += ["--mcp-config", json.dumps(triage.mcp_config),
                    "--strict-mcp-config"]
        if session_id:
            cmd += ["--resume", session_id]
        return cmd

    def build_message(self, user_message: str,
                      triage: TriageResult) -> str:
        # Skills prepended as /skill-name — invisible to user
        skill_prefix = "\n".join(f"/{s}" for s in triage.skills)
        if skill_prefix:
            return f"{skill_prefix}\n{user_message}"
        return user_message
```

### Task category → tools/MCPs/skills mapping

```python
TASK_ROUTING = {
    "frontend_design": TaskConfig(
        keywords=["ui", "ux", "form", "component", "design", "layout",
                  "css", "style", "responsive", "animation", "tailwind"],
        tools=["Read", "Write", "Edit", "WebSearch"],
        mcps=["ux-kit", "omni-ui-ux"],
        skills=["frontend-design", "frontend-patterns"],
        effort="medium",
    ),
    "backend_api": TaskConfig(
        keywords=["api", "endpoint", "route", "fastapi", "server",
                  "database", "sql", "migration", "crud", "schema"],
        tools=["Read", "Write", "Edit", "Bash"],
        mcps=[],
        skills=["backend-patterns", "api-design", "postgres-patterns"],
        effort="medium",
    ),
    "code_review": TaskConfig(
        keywords=["review", "check", "audit", "bug", "fix",
                  "refactor", "improve", "optimize", "issue"],
        tools=["Read", "Grep", "Glob", "Bash"],
        mcps=[],
        skills=["code-review", "security-review"],
        effort="low",
    ),
    "research": TaskConfig(
        keywords=["search", "find", "look up", "what is", "how to",
                  "explain", "compare", "best practice"],
        tools=["WebSearch", "WebFetch", "Read"],
        mcps=[],
        skills=["deep-research"],
        effort="low",
    ),
    "memory_ops": TaskConfig(
        keywords=["remember", "save", "recall", "note", "context",
                  "history", "previous", "last time"],
        tools=["mcp__memovault__*"],
        mcps=["memovault"],
        skills=[],
        effort="low",
    ),
    "general_coding": TaskConfig(   # fallback
        keywords=[],
        tools=["Read", "Write", "Edit", "Bash", "Grep", "Glob", "WebSearch"],
        mcps=["memovault"],
        skills=[],
        effort="medium",
    ),
}
```

### New files
```
A  backend/app/services/triage.py
A  backend/app/services/skill_index.py    (skill descriptions + embeddings)
```

---

## Phase 3 — Dual GUI Mode (Chat Bubbles + Terminal)
> **Goal:** Friendly chatbot UI by default, raw terminal available for power users
> **Effort:** ~2 weeks | **Risk:** Low | **Value:** High (UX differentiator)

### Two views, one data source

Both views consume the **same WebSocket stream** of `stream-json` events. Rendering differs only on the frontend.

```
Claude CLI stdout (stream-json events)
           ↓
    FastAPI WebSocket
           ↓
 Frontend receives same events
    ├── Chat mode:    parse JSON → render bubbles + tool cards
    └── Terminal mode: strip JSON envelope → render ANSI text via xterm.js
```

### Chat Bubbles mode (default)

```
User message:   [💬 "Create a login form"]
                
Claude thinking: [● thinking...]  ← animated, from partial_message events

Claude response: [💬 "I'll create a responsive login form with..."]

Tool call:       [🔧 Write → frontend/LoginForm.jsx]  ← collapsible
                  ▶ Show diff

Tool call:       [🔧 Edit → frontend/App.jsx]  ← collapsible

Claude response: [💬 "Done! The login form includes..."]

Result:          [📊 session: abc-123 | sonnet | 0.04 USD | 2.3s]
```

### Terminal mode (toggle)

```
>_ claude --print --output-format stream-json ...

  ✓ Writing frontend/LoginForm.jsx
  ✓ Editing frontend/App.jsx
  
  Done! The login form includes validation, error states...
  
[session: abc-123 | 0.04 USD]
```

### Frontend components

```
frontend/src/components/
  Chat/
    ChatView.jsx          ← main chat container
    MessageBubble.jsx     ← user/assistant messages
    ToolCallCard.jsx      ← collapsible tool call + result
    ThinkingIndicator.jsx ← animated "thinking..." 
    SessionFooter.jsx     ← tokens, cost, session ID
  Terminal/
    TerminalView.jsx      ← xterm.js wrapper
    AnsiParser.jsx        ← strip JSON, extract text+ANSI
  Shared/
    GUIModeToggle.jsx     ← [💬 Chat] [>_ Terminal] switch
    ConfirmationDialog.jsx← plan mode approval UI
```

### Toggle behavior

```javascript
// Persisted to localStorage, applied immediately
const [guiMode, setGuiMode] = useLocalStorage('gui_mode', 'chat')
// 'chat' | 'terminal'
```

---

## Phase 4 — Confirmation Before Execution (Plan Mode)
> **Goal:** User reviews and approves Claude's plan before any files are modified
> **Effort:** ~1 week | **Risk:** Low | **Value:** Critical for trust and safety

### Two-phase execution flow

```
Phase A — Plan (read-only):
  claude --permission-mode plan ...
  Claude outputs: "I will do X, Y, Z"
  → Frontend renders as checklist proposal
  → User can: ✅ Confirm | ✏️ Edit prompt | ❌ Cancel

Phase B — Execute (after confirmation):
  claude --permission-mode auto --resume <session_id>
  Uses same session → context preserved
  → Frontend switches to normal chat/terminal view
```

### Confirmation UI (Chat mode)

```
┌─────────────────────────────────────────────────────┐
│  📋 Claude's Plan                                    │
│                                                      │
│  I'll create a login form by:                        │
│  ☐ Read existing App.jsx                             │
│  ☐ Create frontend/LoginForm.jsx (~80 lines)         │
│  ☐ Edit App.jsx to import LoginForm                  │
│  ☐ Run: npm run build (verify no errors)             │
│                                                      │
│  [✅ Looks good, proceed]  [✏️ Change something]     │
└─────────────────────────────────────────────────────┘
```

### Destructive action gates

Beyond plan mode, additional confirmation for:
- `rm`, `git reset --hard`, database drops → explicit dialog
- Writing to files outside project directory → explicit dialog
- Running arbitrary shell commands → show command before running

### Configuration

```python
# User preference — can be disabled for trust/speed
CONFIRMATION_MODE: Literal["always", "smart", "off"] = "smart"
# smart = only for tasks that touch >2 files or run shell commands
```

---

## Phase 5 — Memory Brain (3-Tier) + Chiron Knowledge Engine
> **Goal:** System learns and remembers everything — conversation facts, user profile, and a compiled wiki knowledge base powered by Chiron
> **Effort:** ~4 weeks | **Risk:** Medium (schema merge complexity) | **Value:** Highest long-term

### Three memory tiers

```
Tier 1 — Session Memory (short-term, minutes)
  What's happening in current conversation
  Managed by: Claude Code CLI --resume session_id
  Storage: Claude Code's own session files
  Lifecycle: current session only

Tier 2 — Conversation Facts (mid-term, permanent) — GLOBAL
  Facts extracted from past sessions (applies to ALL workspaces):
    • Tech stack: FastAPI + React + PostgreSQL
    • Code style: type hints everywhere, ruff formatting
    • Preferences: no magic numbers, small functions
    • Patterns: tends to build AI/RAG systems
  Storage: memories + user_knowledge_profile tables (PostgreSQL)
  Injected into: --append-system-prompt on every request
  Updated: async after each session ends (Celery task → Haiku)

Tier 3 — Chiron Knowledge Wiki (long-term, permanent) — SCOPED
  Uploaded documents, READMEs, architecture docs, URLs
  Two scopes:
    • Global: applies to all workspaces (shared patterns, personal docs)
    • Workspace: specific to one repo (that repo's README, ADRs, etc.)
  Storage: chiron_wiki_pages + chiron_sources tables (adapted from source code)
  Compiled via: MRP Pipeline (Map → Reduce → Plan → Refine → Verify → Commit)
  Retrieved: pgvector semantic search → top-K wiki pages injected
  Served via: 25+ MCP tools → Claude reads via /chiron/mcp
```

### Why Chiron wiki > basic chunk RAG

| Existing RAG (rag_documents) | Arkon Wiki Layer |
|---|---|
| Chunks → embed → search | Documents → LLM compile → wiki pages → embed |
| Chunk soup in context | Coherent narrative markdown pages |
| No cross-doc relationships | `[[wikilinks]]` between pages, refreshed graph |
| Re-embed everything on update | LLM merge + atomic version bump |
| No review gate | Human approval before knowledge committed |
| No version history | Every revision immutable + timestamped |
| Single embedding dimension | 4 dimension tables: 768/1024/1536/3072d |

---

### Chiron — What We Adapt (Backend Only)

**We take:** All backend code from source, adapted to Chiron namespace. We skip: Next.js frontend, Employee/Department/Role/Project models (use our User + Workspace instead).

#### Directory layout after integration

```
backend/app/
├── chiron/                       ← Chiron knowledge engine
│   ├── models/                   ← SQLAlchemy models (merged into our Alembic)
│   │   ├── source.py             ← ChironSource, ChironSourceImage
│   │   ├── mrp.py                ← SourceChunkExtract, SourceCompilationPlan
│   │   ├── wiki.py               ← WikiPage, WikiLink, WikiPageDraft, WikiPageRevision
│   │   ├── embeddings.py         ← WikiPageEmbedding768/1024/1536/3072, EmbeddingJob
│   │   └── config.py             ← KnowledgeType, AppConfig
│   ├── ai/
│   │   ├── registry.py           ← ProviderRegistry (LLM/embedding/vision at runtime)
│   │   ├── embedding_catalog.py  ← supported embedding models whitelist
│   │   ├── wiki_compiler.py      ← LLM-driven wiki page generation
│   │   ├── wiki_analyzer.py
│   │   └── mrp/                  ← Map-Reduce-Plan pipeline
│   │       ├── pipeline.py       ← orchestrator, phases 0-5
│   │       ├── mapper.py         ← phase 1: chunk extraction
│   │       ├── reducer.py        ← phase 2: plan generation
│   │       ├── writer.py         ← phase 3-4: page write
│   │       ├── verifier.py       ← phase 5: verify & commit
│   │       └── merger.py         ← merge conflict resolution
│   ├── mcp/
│   │   ├── server.py             ← FastMCP server (mounted at /chiron/mcp)
│   │   └── tools.py              ← 25+ MCP tools (auth → our User.mcp_token)
│   ├── services/
│   │   ├── wiki_service.py       ← wiki CRUD, semantic search, wikilink graph
│   │   ├── storage_service.py    ← MinIO client (upload/download/presign)
│   │   ├── embedding_storage.py  ← embedding upsert, hash tracking
│   │   ├── kb_service.py         ← text extraction, outlines
│   │   └── config_service.py     ← app_config K-V store
│   ├── repositories/
│   │   ├── source_repo.py
│   │   ├── wiki_repo.py
│   │   └── knowledge_type_repo.py
│   ├── routes/                   ← REST API under /api/chiron/
│   │   ├── sources.py            ← upload/ingest/pipeline management
│   │   ├── wiki.py               ← wiki page CRUD + search
│   │   ├── wiki_drafts.py        ← draft proposal/approval
│   │   └── knowledge_types.py    ← knowledge classification
│   └── worker/
│       └── tasks/
│           ├── ingest_tasks.py   ← ingest_file_task, ingest_url_task
│           ├── mrp_tasks.py      ← ingest_map_reduce_task, ingest_refine_task
│           └── caption_tasks.py  ← caption_images_task
```

---

### Database Models — What We Add (Chiron Models → Our Alembic)

We skip: `Employee`, `Role`, `Department`, `Project`, `ProjectMember` — use our own `User` + `Workspace` models.

We take and adapt:

```python
# backend/app/chiron/models/source.py
class ChironSource(Base):            # namespaced to avoid conflict with any existing "sources"
    __tablename__ = "chiron_sources"
    id: UUID
    title: str | None
    full_text: str | None
    source_type: str                  # "file" | "url"
    knowledge_type_id: UUID | None    # FK KnowledgeType
    workspace_id: UUID | None         # FK Workspace (None = global knowledge)
    contributed_by_user_id: UUID | None  # FK User
    file_path: str | None
    url: str | None
    minio_key: str | None
    file_name: str | None
    file_size: int | None
    status: str                       # pending | processing | error | ready
    progress: int
    progress_message: str | None
    job_id: str | None
    pipeline_strategy: str | None     # single_pass | standard | hierarchical
    pipeline_phase: str | None
    outline_json: list[dict] | None   # JSONB: heading TOC tree
    page_offsets: list[int] | None
    metadata_: dict | None            # JSONB
    created_at: datetime
    updated_at: datetime

class ChironSourceImage(Base):
    __tablename__ = "chiron_source_images"
    id: UUID
    source_id: UUID                   # FK ChironSource CASCADE
    minio_key: str
    page_number: int | None
    image_index: int
    caption: str | None
    content_type: str
    size_bytes: int
    created_at: datetime

# backend/app/chiron/models/mrp.py
class SourceChunkExtract(Base):
    __tablename__ = "chiron_chunk_extracts"
    id: UUID
    source_id: UUID                   # FK ChironSource CASCADE, INDEX
    chunk_index: int
    start_char: int
    end_char: int
    section_path: str | None
    extract_json: dict | None         # JSONB
    status: str                       # pending | done | error
    error_message: str | None
    created_at: datetime

class SourceCompilationPlan(Base):
    __tablename__ = "chiron_compilation_plans"
    id: UUID
    source_id: UUID                   # FK ChironSource UNIQUE CASCADE
    plan_json: dict                   # JSONB: list of page operations
    status: str                       # pending_review | approved | in_progress | done | rejected
    reviewed_by: UUID | None          # FK User (was Employee)
    review_note: str | None
    created_at: datetime
    reviewed_at: datetime | None

# backend/app/chiron/models/wiki.py
class WikiPage(Base):
    __tablename__ = "chiron_wiki_pages"
    id: UUID
    slug: str                         # UNIQUE, e.g. "concept/fastapi-patterns"
    title: str
    page_type: str                    # entity | concept | topic | source | index | log
    content_md: str
    summary: str
    knowledge_type_slugs: list[str]   # ARRAY
    source_ids: list[UUID]            # ARRAY
    version: int
    orphaned: bool
    created_at: datetime
    updated_at: datetime

class WikiLink(Base):
    __tablename__ = "chiron_wiki_links"
    from_slug: str                    # PK, FK WikiPage.slug
    to_slug: str                      # PK, FK WikiPage.slug

class WikiPageDraft(Base):
    __tablename__ = "chiron_wiki_drafts"
    id: UUID
    page_id: UUID                     # FK WikiPage CASCADE
    author_id: UUID | None            # FK User (was Employee)
    content_md: str
    note: str | None
    status: str                       # pending | approved | rejected
    source: str                       # web_ui | mcp_claude_code | api_direct
    source_metadata: dict | None      # JSONB
    reviewed_by_id: UUID | None       # FK User
    reviewed_at: datetime | None
    reviewer_note: str | None
    created_at: datetime
    updated_at: datetime

class WikiPageRevision(Base):
    __tablename__ = "chiron_wiki_revisions"
    id: UUID
    page_id: UUID                     # FK WikiPage CASCADE
    version: int
    content_md: str
    change_type: str                  # agent_compile | editor_edit | draft_approved | rollback
    changed_by_id: UUID | None        # FK User
    change_note: str | None
    created_at: datetime

# backend/app/chiron/models/embeddings.py
# Four tables for different embedding dimensions
class WikiPageEmbedding768(Base):
    __tablename__ = "chiron_embeddings_768"
    page_id: UUID                     # PK, FK WikiPage CASCADE
    model_spec_id: str                # PK, e.g. "openai/text-embedding-3-small"
    embedding: Vector(768)            # pgvector HNSW index
    content_hash: str                 # SHA256 for cache invalidation
    embedded_at: datetime

# WikiPageEmbedding1024, WikiPageEmbedding1536 → same structure
# WikiPageEmbedding3072 → uses HALFVEC(3072) for HNSW compatibility

class EmbeddingJob(Base):
    __tablename__ = "chiron_embedding_jobs"
    id: UUID
    model_spec_id: str
    status: str                       # pending | running | completed | failed
    total_pages: int
    done_pages: int
    error_message: str | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime

# backend/app/chiron/models/config.py
class KnowledgeType(Base):
    __tablename__ = "chiron_knowledge_types"
    id: UUID
    slug: str                         # UNIQUE, e.g. "sop", "architecture-doc", "preference"
    name: str
    color: str                        # hex for UI badges
    description: str | None
    sort_order: int
    created_at: datetime

class AppConfig(Base):
    __tablename__ = "chiron_config"
    key: str                          # PK, e.g. "active_embedding_model_spec_id"
    value: str | None
    updated_at: datetime
```

---

### Auth Adaptation — Our User → Arkon's Employee

Arkon uses `Employee` with `mcp_token` for MCP auth. We adapt by adding `mcp_token` to our existing `User` model:

```python
# Migration: add mcp_token to users table
class User(Base):
    ...existing fields...
    mcp_token: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True, index=True
    )
    # Generated once per user: secrets.token_hex(32)
    # Used for MCP tool authentication (replaces Arkon's Employee.mcp_token)
```

MCP auth service adapted:
```python
class MCPAuthService:
    async def verify_token(self, token: str) -> ResolvedIdentity | None:
        user = await user_repo.get_by_mcp_token(self.db, token)
        if not user or not user.is_active:
            return None
        return ResolvedIdentity(
            user_id=user.id,
            is_admin=user.role == UserRole.ADMIN,
            allowed_knowledge_types=None,  # all types for now
        )
```

---

### Worker Jobs — Arq alongside Celery

Arkon uses `arq` (async Redis queue). We add arq **alongside** existing Celery (not replace):
- Celery: existing tasks (RAG sync, etc.)
- Arq: knowledge ingestion pipeline (heavy LLM calls, resumable)

```python
# backend/app/knowledge/worker/arq_settings.py
async def startup(ctx):
    ctx['db'] = create_async_session()
    ctx['storage'] = StorageService()

WORKER_SETTINGS = WorkerSettings(
    functions=[
        ingest_file_task,
        ingest_url_task,
        caption_images_task,
        ingest_map_reduce_task,
        ingest_refine_task,
    ],
    on_startup=startup,
    max_jobs=3,
    job_timeout=1800,
)
```

---

### MRP Pipeline — 6 Phases (Source → Wiki)

```
Source uploaded (file/URL)
    ↓
Phase 0: TRIAGE — analyze size → pick strategy
    single_pass  (<10k chars)   → one MAP pass
    standard     (10-200k)      → chunked MAP → REDUCE
    hierarchical (>200k)        → multi-level MAP+REDUCE
    ↓
Phase 1: MAP — chunk source → LLM extracts knowledge per chunk
    Stores: SourceChunkExtract rows (resumable)
    ↓
Phase 2: REDUCE — LLM reads all chunks → produces compilation plan
    Stores: SourceCompilationPlan.plan_json
    Status: pending_review
    ↓
    ★ HUMAN REVIEW GATE ★
    User reviews plan in UI → Approve / Reject / Edit
    (MRP_AUTO_APPROVE_PLAN=True skips this gate)
    ↓
Phase 3: REFINE — LLM writes actual wiki page content (markdown)
    Produces: list of PageWriteResult
    ↓
Phase 4: VERIFY — checks quality
    Minimum word count per page_type
    At least 1 wikilink per page
    Slug format validation
    ↓
Phase 5: COMMIT — atomically write to wiki_pages
    Upsert WikiPage rows
    Compute & store embeddings (pgvector)
    Refresh wikilink graph (parse [[slug]] patterns)
    Regenerate wiki index pages
    Append to _log page
    Set Source.status = "ready"
```

**Resume capability**: If job crashes mid-pipeline, DB state (pipeline_phase, chunk extracts, plan) allows exact resume — no re-running completed phases.

---

### 25+ MCP Tools (Available to Claude via triage)

Mounted at `/chiron/mcp` — Claude accesses via `--mcp-config`:

```python
CHIRON_MCP_CONFIG = {
    "servers": {
        "chiron": {
            "url": "http://localhost:8000/chiron/mcp",
            "headers": {"Authorization": f"Bearer {user.mcp_token}"}
        }
    }
}
```

| Tool | Purpose |
|---|---|
| `search_wiki(query, top_k)` | Semantic search across all wiki pages |
| `read_wiki_index()` | Browse catalog of all pages |
| `read_wiki_page(slug)` | Full markdown + backlinks |
| `list_wiki_pages(type, knowledge_type)` | Filtered browse |
| `get_source(source_id)` | Source metadata + page count |
| `get_source_outline(source_id)` | Heading TOC tree |
| `get_source_pages(source_id, pages)` | Raw text ("5-7", "3,8") |
| `list_sources(status, knowledge_type)` | Browse uploaded docs |
| `list_knowledge_types()` | Classification catalog |
| `propose_wiki_edit(slug, content_md, note)` | Draft edit for review |
| `edit_wiki_page(slug, content_md)` | Direct edit (admin) |
| `list_pending_drafts()` | Review queue |
| `approve_draft(draft_id, edited_content_md)` | Accept with optional edits |
| `reject_draft(draft_id, reviewer_note)` | Reject with reason |

Added to triage task mapping:
```python
TASK_ROUTING["knowledge_retrieval"] = TaskConfig(
    keywords=["find", "what is", "explain", "how does", "architecture",
              "documentation", "decision", "why did", "previous", "our stack"],
    tools=["mcp__chiron__search_wiki", "mcp__chiron__read_wiki_page",
           "mcp__chiron__get_source_pages"],
    mcps=["chiron"],
    skills=["deep-research"],
    effort="low",
)
```

---

### ProviderRegistry — Runtime LLM/Embedding Switching

Arkon's `ProviderRegistry` is more flexible than our current `model_router`. We integrate it as the backend for our routing system:

```python
# Active model config stored in AppConfig table (DB, not env file)
# Key: "active_llm_model_spec_id"    → e.g. "anthropic/claude-sonnet-4-6"
# Key: "active_embedding_model_spec_id" → e.g. "openai/text-embedding-3-small"
# Key: "active_vision_model_spec_id" → e.g. "anthropic/claude-haiku-4-5"

class ProviderRegistry:
    async def get_llm_provider(self) -> BaseLLMProvider
    async def get_embedding_provider(self) -> BaseEmbeddingProvider
    async def get_vision_provider(self) -> BaseVisionProvider
    # Returns live provider based on AppConfig, cached 60s
```

Admin can switch models via API without restart — re-embed job triggered automatically.

---

### MinIO — New Docker Service

```yaml
# docker-compose.yml addition
minio:
  image: minio/minio:latest
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin123
  volumes:
    - minio_data:/data
  ports:
    - "9000:9000"   # API (used by backend)
    - "9001:9001"   # Admin console (http://localhost:9001)
```

File types stored (bucket: `argo-files`):
- `chiron/sources/{source_id}/original.*` — uploaded documents
- `chiron/sources/{source_id}/images/*.png` — extracted PDF images

---

### Tier 2 Memory (Conversation Facts) — Unchanged

```python
class Memory(Base):
    __tablename__ = "memories"
    id: UUID
    user_id: UUID                     # FK User
    content: str                      # extracted fact (≤500 chars)
    summary: str                      # 1-line label
    source_type: str                  # "session" | "document" | "manual"
    importance: float                 # 0.0–1.0, Haiku-scored
    tags: list[str]                   # JSONB
    embedding: list[float]            # 1536d, for dedup
    last_accessed_at: datetime
    access_count: int
    created_at: datetime

class UserKnowledgeProfile(Base):
    __tablename__ = "user_knowledge_profiles"
    id: UUID
    user_id: UUID                     # FK User, UNIQUE
    profile_json: dict                # JSONB: stack, style, preferences, dislikes
    updated_at: datetime
```

Memory extraction runs after session via Celery:
```
Session ends → Celery: extract_memories(session_id, user_id)
    → Haiku analyzes transcript
    → Extracts facts + preferences
    → Deduplicates by embedding similarity
    → Stores in memories table
    → Updates UserKnowledgeProfile.profile_json
```

---

### New Config Settings

```python
# backend/app/core/config.py additions
MINIO_ENDPOINT: str = "localhost:9000"
MINIO_ACCESS_KEY: str = "minioadmin"
MINIO_SECRET_KEY: str = "minioadmin123"
MINIO_BUCKET: str = "argo-files"
MINIO_SECURE: bool = False

CHIRON_AUTO_APPROVE_PLAN: bool = False  # require human review of MRP plan
CHIRON_WORKER_MAX_JOBS: int = 3
CHIRON_WORKER_JOB_TIMEOUT: int = 1800

CHIRON_ACTIVE_LLM_MODEL: str = "anthropic/claude-sonnet-4-6"
CHIRON_ACTIVE_EMBEDDING_MODEL: str = "openai/text-embedding-3-small"
```

---

### New Files — Phase 5

```
# Models (merged into alembic)
A  backend/app/knowledge/models/source.py
A  backend/app/knowledge/models/mrp.py
A  backend/app/knowledge/models/wiki.py
A  backend/app/knowledge/models/embeddings.py
A  backend/app/knowledge/models/config.py
A  backend/alembic/versions/XXXX_add_knowledge_brain.py

# AI pipeline (from Arkon, adapted)
A  backend/app/knowledge/ai/registry.py
A  backend/app/knowledge/ai/embedding_catalog.py
A  backend/app/knowledge/ai/wiki_compiler.py
A  backend/app/knowledge/ai/wiki_analyzer.py
A  backend/app/knowledge/ai/mrp/pipeline.py
A  backend/app/knowledge/ai/mrp/mapper.py
A  backend/app/knowledge/ai/mrp/reducer.py
A  backend/app/knowledge/ai/mrp/writer.py
A  backend/app/knowledge/ai/mrp/verifier.py
A  backend/app/knowledge/ai/mrp/merger.py

# MCP server
A  backend/app/knowledge/mcp/server.py
A  backend/app/knowledge/mcp/tools.py

# Services (from Arkon, adapted)
A  backend/app/knowledge/services/wiki_service.py
A  backend/app/knowledge/services/storage_service.py
A  backend/app/knowledge/services/embedding_storage.py
A  backend/app/knowledge/services/kb_service.py
A  backend/app/knowledge/services/config_service.py

# Repositories
A  backend/app/knowledge/repositories/source_repo.py
A  backend/app/knowledge/repositories/wiki_repo.py

# Routes (adapted, no Next.js)
A  backend/app/knowledge/routes/sources.py
A  backend/app/knowledge/routes/wiki.py
A  backend/app/knowledge/routes/wiki_drafts.py
A  backend/app/knowledge/routes/knowledge_types.py

# Worker (arq alongside Celery)
A  backend/app/knowledge/worker/arq_settings.py
A  backend/app/knowledge/worker/tasks/ingest_tasks.py
A  backend/app/knowledge/worker/tasks/mrp_tasks.py
A  backend/app/knowledge/worker/tasks/caption_tasks.py

# Tier 2 memory
A  backend/app/db/models/memory.py
A  backend/app/db/models/user_knowledge_profile.py
A  backend/app/repositories/memory.py
A  backend/app/services/memory.py
A  backend/app/worker/tasks/memory_tasks.py

# Modified
M  backend/app/db/models/user.py            (add mcp_token field)
M  backend/app/core/config.py               (MinIO, MRP, embedding settings)
M  backend/app/main.py                      (mount knowledge routes + MCP server)
M  docker-compose.yml                       (add minio + arq worker)
M  backend/pyproject.toml                   (add arq, pgvector, minio, fastmcp, content-core, pymupdf)
```

---

## Phase 6 — In-App Change Timeline
> **Goal:** Every AI-caused change is tracked locally in the app — prompt → files → diff → revert
> **Scope:** IN-APP tracking only. NOT GitHub push. GitHub is a separate feature (Phase 9).
> **Effort:** ~2 weeks | **Risk:** Low | **Value:** High (safety + trust + audit)

### What this tracks

Every time Claude modifies files during a session:
- Which files were changed, how many lines added/removed
- Which prompt caused the change
- Which model/session was used
- Full unified diff (viewable in-app)
- Reversible via `git revert` (creates new commit, never rewrites history)

All of this is **local only** — stored in PostgreSQL + local git. Nothing is pushed to GitHub.

### Architecture

```
User sends message → Claude CLI runs (in plan mode first)
User confirms plan → Claude executes (modifies files)

After session ends (or user clicks "Save checkpoint"):
  1. git add -A
  2. git commit -m "ai(session-abc123): <auto-summary>
     
     Prompt: 'Create a login form with validation'
     Session: abc-123  |  Model: claude-sonnet-4-6
     Time: 2026-05-15T14:32:07+07:00"
  3. Store in change_log (PostgreSQL):
     session_id → commit_hash → prompt → files → diff → timestamp
```

### change_log schema

```python
class ChangeLog(Base):
    __tablename__ = "change_log"
    id: UUID
    user_id: UUID               # FK User
    session_id: str             # Claude CLI session ID
    commit_hash: str            # local git commit SHA (not pushed)
    prompt: str                 # original user message
    prompt_summary: str         # 1-line (Haiku auto-generated)
    files_changed: list[dict]   # JSONB: [{path, additions, deletions}]
    diff_stat: str              # "+82 -1 lines across 2 files"
    diff_content: str           # full unified diff (for in-app viewer)
    model: str                  # e.g. "claude-sonnet-4-6"
    provider: str               # "claude_cli" | "anthropic" | "ollama"
    routing_mode: str
    was_reverted: bool
    reverted_at: datetime | None
    revert_commit_hash: str | None
    created_at: datetime
```

### Change Timeline UI (sidebar panel)

```
┌────────────────────────────────────────────────────────┐
│  Change History                              [Filter ▾] │
│                                                         │
│  ● Today                                               │
│                                                         │
│  14:32  "Create login form with validation"            │
│         claude-sonnet · 2 files · +85 -1               │
│         ├─ frontend/LoginForm.jsx  +82  [diff]         │
│         └─ frontend/App.jsx        +3 -1  [diff]       │
│         [↩ Revert]                                     │
│                                                         │
│  14:15  "Add rate limiting to /login"                  │
│         claude-sonnet · 1 file · +45                   │
│         └─ backend/middleware.py  +45  [diff]          │
│         [↩ Revert]                                     │
│                                                         │
│  ● Yesterday                                            │
│                                                         │
│  09:12  "Fix the CORS issue"                  [reverted]│
│         backend/core/config.py  +2 -1  [diff]         │
└────────────────────────────────────────────────────────┘
```

### Revert mechanism

```python
async def revert_change(change_id: UUID) -> RevertResult:
    change = await change_log_repo.get(db, change_id)
    # git revert = safe: creates new commit, never rewrites history
    result = await run_git(["revert", change.commit_hash, "--no-edit"])
    await change_log_repo.mark_reverted(db, change_id, result.commit_hash)
    return RevertResult(new_commit=result.commit_hash, reverted=change.commit_hash)
```

### New files

```
A  backend/app/db/models/change_log.py
A  backend/app/repositories/change_log.py
A  backend/app/services/change_tracker.py
A  backend/app/api/routes/v1/changes.py
A  frontend/src/components/ChangeTimeline/TimelinePanel.jsx
A  frontend/src/components/ChangeTimeline/DiffViewer.jsx
A  frontend/src/components/ChangeTimeline/RevertButton.jsx
A  backend/alembic/versions/XXXX_add_change_log.py
```

---

## Phase 9 — GitHub OAuth Integration
> **Goal:** Connect to GitHub like VSCode — browse repos, branches, PRs, diffs in sidebar
> **Scope:** Completely separate from Phase 6 change tracking. This is GitHub API display only.
> **Effort:** ~2 weeks | **Risk:** Low | **Value:** Medium (developer workflow convenience)

### What this adds

- OAuth 2.0 login with GitHub (separate from main app login)
- Sidebar panel: your repos → branches → open PRs → files changed
- Click a PR → view full diff inline (like VSCode GitHub Pull Requests extension)
- Click a file in diff → "Use in chat" → loads file context into current Claude session
- Create PR from current branch (optional, Phase 9b)

### GitHub sidebar UI

```
┌──────────────────────────────────────────────────┐
│  GitHub                              [Disconnect] │
│                                                   │
│  ▸ ai_multi_agent (main)                         │
│    ├── Branches  ● main  ○ feat/knowledge         │
│    └── Pull Requests (2 open)                    │
│        ├── #42 feat: add knowledge brain          │
│        │   ├─ backend/app/knowledge/wiki.py +340  │
│        │   └─ docker-compose.yml +15              │
│        │   [View diff]  [Use in chat →]           │
│        └── #41 fix: minio connection timeout      │
│                                                   │
│  ▸ other-repo (feat/login)                       │
└──────────────────────────────────────────────────┘
```

### Architecture

```
User clicks "Connect GitHub"
    → OAuth 2.0 Device Flow or Web Application Flow
    → Access token stored (encrypted) in user_oauth_tokens table

Backend proxies GitHub API calls:
  GET /api/github/repos         → list user repos
  GET /api/github/repos/:owner/:repo/branches
  GET /api/github/repos/:owner/:repo/pulls
  GET /api/github/pulls/:number/files
  GET /api/github/pulls/:number/diff

Frontend renders:
  - Repo tree in sidebar
  - PR diff in inline viewer
  - "Use in chat" injects file content into message input
```

### New files

```
A  backend/app/db/models/oauth_token.py        # encrypted token storage
A  backend/app/services/github_oauth.py        # OAuth flow + token refresh
A  backend/app/api/routes/v1/github.py         # proxy endpoints
A  frontend/src/components/GitHub/GitHubPanel.jsx
A  frontend/src/components/GitHub/PRDiffViewer.jsx
A  backend/alembic/versions/XXXX_add_oauth_tokens.py
```

### Not included in Phase 9

- No auto-push to GitHub (user does that via terminal)
- No CI/CD status display
- No merge/approve PR from app

---

## Complete Phase Order

| Phase | Name | Effort | Dependencies |
|---|---|---|---|
| 1 | Hybrid Router + Claude CLI | 1 week | none |
| 2 | Task Triage | 1 week | Phase 1 |
| 3 | Dual GUI (Chat + Terminal) | 2 weeks | Phase 1 |
| 4 | Confirmation (Plan Mode) | 1 week | Phase 1, 3 |
| 5 | Memory Brain + Arkon Knowledge Wiki | 4 weeks | Phase 1, 2 |
| 6 | In-App Change Timeline | 2 weeks | Phase 1, 3 |
| 7 | Task Board (Kanban) | 3 weeks | Phase 1, 3, 4 |
| 8 | Tool Ecosystem + Channels | 4 weeks | Phase 1, 7 |
| 9 | GitHub OAuth Integration | 2 weeks | Phase 3 |

Phases 1–4 sequential (~5 weeks). Phase 5 + 6 can run in parallel. Phase 9 independent after Phase 3.

---

## Routing Mode Matrix

| Scenario | Recommended Mode | Provider used |
|---|---|---|
| No internet | `force_local` | Ollama |
| Have Pro/Max subscription | `auto` | Claude CLI → Ollama fallback |
| Have API credits | `prefer_cloud` | Anthropic API |
| Cost-sensitive bulk | `prefer_local` | Ollama → Claude CLI fallback |
| Per-task override | set on task | any |

---

## Technology Decisions

| Concern | Choice | Rationale |
|---|---|---|
| Primary AI execution | Claude Code CLI subprocess | Uses Pro/Max, no credits needed |
| CLI output parsing | `stream-json` events | Structured, no ANSI parsing |
| Session continuity | `--resume session_id` | Built into CLI, no custom logic |
| Confirmation | `--permission-mode plan` | Built into CLI |
| Terminal UI | `xterm.js` (optional, power user) | Industry standard |
| Chat UI | Custom React components | Full control over UX |
| Skill injection | `/skill-name` prepend | Transparent to user |
| Tool selection | `--allowedTools` per triage | Reduces system prompt 87% |
| Memory extraction | Haiku/Gemma4 async | Cost-efficient batch |
| Change tracking | `git revert` | Safe, non-destructive |

---

## What We Are NOT Doing

- ❌ Rewriting backend in Rust — Python is fast enough
- ❌ Tauri desktop app — web app with CLI subprocess works well
- ❌ Voice STT/TTS — not core, add later
- ❌ 118 tool integrations upfront — registry first, add incrementally
- ❌ Hardcoded online/offline mode — hybrid router handles it
- ❌ Custom LLM orchestration for heavy tasks — Claude Code CLI does it better

---

## File Change Map

### Phase 1 (Router + CLI)
```
M  backend/app/agents/pipeline/model_router.py
M  backend/app/core/config.py
A  backend/app/services/claude_cli.py
A  backend/app/api/routes/v1/providers.py
A  frontend/src/components/ProviderStatusBar.jsx
```

### Phase 2 (Triage)
```
A  backend/app/services/triage.py
A  backend/app/services/skill_index.py
```

### Phase 3 (Dual GUI)
```
A  frontend/src/components/Chat/ChatView.jsx
A  frontend/src/components/Chat/MessageBubble.jsx
A  frontend/src/components/Chat/ToolCallCard.jsx
A  frontend/src/components/Chat/ThinkingIndicator.jsx
A  frontend/src/components/Chat/SessionFooter.jsx
A  frontend/src/components/Terminal/TerminalView.jsx
A  frontend/src/components/Shared/GUIModeToggle.jsx
M  frontend/src/App.jsx
M  backend/app/api/routes/v1/  (WebSocket streaming endpoint)
```

### Phase 4 (Confirmation)
```
A  frontend/src/components/Shared/ConfirmationDialog.jsx
A  frontend/src/components/Shared/PlanChecklist.jsx
M  backend/app/services/claude_cli.py  (plan → execute two-phase)
```

### Phase 5 (Memory Brain + Chiron Knowledge Engine)
```
# Chiron models (adapted, merged into Alembic)
A  backend/app/chiron/models/source.py       (ChironSource, ChironSourceImage)
A  backend/app/chiron/models/mrp.py          (SourceChunkExtract, SourceCompilationPlan)
A  backend/app/chiron/models/wiki.py         (WikiPage, WikiLink, WikiPageDraft, WikiPageRevision)
A  backend/app/chiron/models/embeddings.py   (WikiPageEmbedding768/1024/1536/3072, EmbeddingJob)
A  backend/app/chiron/models/config.py       (KnowledgeType, AppConfig)

# Chiron AI pipeline (adapted)
A  backend/app/chiron/ai/registry.py
A  backend/app/chiron/ai/embedding_catalog.py
A  backend/app/chiron/ai/wiki_compiler.py
A  backend/app/chiron/ai/wiki_analyzer.py
A  backend/app/chiron/ai/mrp/  (pipeline, mapper, reducer, writer, verifier, merger)

# Chiron MCP server → /chiron/mcp
A  backend/app/chiron/mcp/server.py
A  backend/app/chiron/mcp/tools.py

# Services
A  backend/app/chiron/services/  (wiki, storage, embedding, kb, config)

# Repositories + Routes → /api/chiron/
A  backend/app/chiron/repositories/  (source_repo, wiki_repo)
A  backend/app/chiron/routes/  (sources, wiki, wiki_drafts, knowledge_types)

# Worker (arq alongside Celery)
A  backend/app/chiron/worker/arq_settings.py
A  backend/app/chiron/worker/tasks/  (ingest, mrp, caption)

# Workspace model
A  backend/app/db/models/workspace.py
A  backend/app/repositories/workspace.py
A  backend/app/services/workspace.py
A  backend/app/api/routes/v1/workspaces.py

# Tier 2 memory
A  backend/app/db/models/memory.py
A  backend/app/db/models/user_knowledge_profile.py
A  backend/app/repositories/memory.py
A  backend/app/services/memory.py
A  backend/app/worker/tasks/memory_tasks.py

# Modified
M  backend/app/db/models/user.py         (add mcp_token field)
M  backend/app/core/config.py            (MINIO_*, CHIRON_* settings)
M  backend/app/main.py                   (mount /api/chiron/ routes + /chiron/mcp)
M  docker-compose.yml                    (add minio + arq worker services)
M  backend/pyproject.toml               (arq, pgvector, minio, fastmcp, content-core, pymupdf)
A  backend/alembic/versions/XXXX_add_workspace.py
A  backend/alembic/versions/XXXX_add_chiron_engine.py
A  backend/alembic/versions/XXXX_add_memory_brain.py
```

### Phase 6 (In-App Change Timeline)
```
A  backend/app/db/models/change_log.py
A  backend/app/repositories/change_log.py
A  backend/app/services/change_tracker.py
A  backend/app/api/routes/v1/changes.py
A  frontend/src/components/ChangeTimeline/TimelinePanel.jsx
A  frontend/src/components/ChangeTimeline/DiffViewer.jsx
A  frontend/src/components/ChangeTimeline/RevertButton.jsx
A  backend/alembic/versions/XXXX_add_change_log.py
```

### Phase 9 (GitHub OAuth)
```
A  backend/app/db/models/oauth_token.py
A  backend/app/services/github_oauth.py
A  backend/app/api/routes/v1/github.py
A  frontend/src/components/GitHub/GitHubPanel.jsx
A  frontend/src/components/GitHub/PRDiffViewer.jsx
A  backend/alembic/versions/XXXX_add_oauth_tokens.py
```

---

## Open Questions

1. **Confirmation threshold** — "smart" mode: trigger plan phase when task touches >2 files or runs shell commands?
2. **Memory eviction** — LRU after 1000 entries? Time-based TTL for stale facts?
3. **Change tracking scope** — track all sessions or only confirmed (post-plan) sessions?
4. **Chiron auto-approve** — `CHIRON_AUTO_APPROVE_PLAN=True` by default (faster) or always require human review of MRP plan?
5. **Embedding model** — start with `openai/text-embedding-3-small` (best quality/price) or a local model for full offline?
6. **pgvector setup** — need to enable extension: `CREATE EXTENSION vector;` in existing PostgreSQL
7. **arq vs Celery coexistence** — run arq as separate Docker service, Celery for existing tasks
