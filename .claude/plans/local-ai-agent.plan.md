# Plan: Argo Local AI Agent

**Author:** Claude Sonnet 4.6 + Jason  
**Date:** 2026-06-02  
**Status:** `pending`  
**Complexity:** Large  

---

## Mục tiêu

Xây dựng `OllamaCodeSession` — một local AI coding agent chạy hoàn toàn offline, được
wire vào chat pipeline hiện có của Argo như một fallback hoặc parallel track bên cạnh
`ClaudeCliSession`. Stack gồm: **Local Model + RAG (Chiron) + Memory (argomemory) +
Skills (triage) + Tool Execution + Planner**, sử dụng toàn bộ infrastructure đã có mà
không cần fine-tune model.

---

## Tóm tắt thay đổi

```
BEFORE                          AFTER
──────────────────────          ──────────────────────────────────────────
User → chat.py                  User → chat.py
      → run_session()                 → route_session()
      → ClaudeCliSession                ├─ Claude online + write task
      → Claude CLI subprocess           │   → run_session() → ClaudeCliSession
                                        └─ Claude offline / read-only / force_local
                                            → run_local_session()
                                            → OllamaCodeSession
                                                ├─ Context Builder
                                                │   ├─ Chiron RAG
                                                │   ├─ argomemory LTM
                                                │   └─ codegraph symbols
                                                ├─ Task Planner
                                                ├─ Ollama API (OpenAI-compat)
                                                └─ Tool Executor
                                                    ├─ Read / Write / Edit
                                                    ├─ Bash (sandboxed)
                                                    └─ Grep / Glob
```

---

## Codebase Patterns (grounding)

| Category | Source | Pattern |
|---|---|---|
| Session interface | `services/claude_cli.py:87` | Class với `async start()` → `AsyncIterator[CLIEvent]` |
| Event format | `services/claude_cli.py:72` | `CLIEvent(type, subtype, data, session_id, text)` dataclass |
| Tool calling | `argon/ai/providers/openai_provider.py:115` | `generate_with_tools()` dùng OpenAI SDK, `base_url` override cho Ollama |
| Memory inject | `api/routes/v1/chat.py:265` | `memory_svc.recall_context(query)` → append vào `parts[]` |
| RAG search | `services/chiron.py:297` | `ChironService.search(workspace_id, query, top_k)` → `list[dict]` |
| Config routing | `core/config.py:153` | `ROUTING_MODE: Literal["auto","prefer_local","prefer_cloud","force_local","force_cloud"]` |
| Session dispatch | `services/chat_session.py:44` | `run_session()` tạo session, register `_active`, yield events |
| Error handling | `api/routes/v1/chat.py:368` | `except Exception: yield _sse({"type": "error", "message": str(exc)})` |

---

## Files to Change

| File | Action | Lý do |
|---|---|---|
| `backend/app/services/connectivity.py` | **CREATE** | Claude online/offline probe với TTL cache |
| `backend/app/services/context_builder.py` | **CREATE** | Wire Chiron RAG + Memory + codegraph → 1 context string |
| `backend/app/services/tool_executor.py` | **CREATE** | Execute Read/Write/Edit/Bash/Grep/Glob với guards + retry |
| `backend/app/services/task_planner.py` | **CREATE** | Rule-based plan templates + LLM fallback |
| `backend/app/services/ollama_session.py` | **CREATE** | `OllamaCodeSession` — same CLIEvent interface as `ClaudeCliSession` |
| `backend/app/services/chat_session.py` | **UPDATE** | Thêm `route_session()` dispatch logic |
| `backend/app/core/config.py` | **UPDATE** | Thêm `OLLAMA_CHAT_MODEL`, `OLLAMA_PLAN_MODEL`, `LOCAL_CONTEXT_TOKENS` |
| `backend/app/api/routes/v1/chat.py` | **UPDATE** | Thay `run_session()` → `route_session()` (1 dòng) |
| `backend/.env.example` | **UPDATE** | Document các env vars mới |

**Không thay đổi:** Frontend, database schema, SSE format, `ClaudeCliSession`, `chat.py` logic.

---

## Dependency Graph

```
Phase 1: connectivity.py          ← không deps
Phase 2: context_builder.py       ← chiron.py + memory_svc.py (đã có)
Phase 3: tool_executor.py         ← không deps
Phase 4: task_planner.py          ← triage.py (đã có)
Phase 5: ollama_session.py        ← Phase 1 + 2 + 3 + 4
Phase 6: chat_session.py patch    ← Phase 1 + 5
Phase 7: config.py + chat.py      ← Phase 5 + 6
```

---

## Phase 1 — Connectivity Probe

**File:** `backend/app/services/connectivity.py` (~70 lines)

```python
import asyncio, shutil
from functools import lru_cache
from app.core.config import settings

_claude_ok:  bool | None = None
_ollama_ok:  bool | None = None
_cache_ts:   float = 0.0
_CLAUDE_TTL  = 60.0   # seconds
_OLLAMA_TTL  = 30.0

async def claude_is_online() -> bool:
    """Spawn `claude --version` with 5s timeout. Cached CLAUDE_TTL seconds."""
    ...

async def ollama_is_online() -> bool:
    """GET {OLLAMA_HOST}/api/tags with 3s timeout. Cached OLLAMA_TTL seconds."""
    ...

async def routing_decision(triage: TriageResult) -> Literal["claude", "ollama"]:
    mode = settings.ROUTING_MODE
    if mode == "force_local":  return "ollama"
    if mode == "force_cloud":  return "claude"

    c_online = await claude_is_online()
    o_online = await ollama_is_online()

    _WRITE = {"Write", "Edit", "MultiEdit", "Bash"}
    has_write = bool(_WRITE & set(triage.allowed_tools))

    if mode == "prefer_local":
        return "ollama" if o_online else "claude"
    if mode == "prefer_cloud":
        return "claude" if c_online else ("ollama" if o_online else "claude")

    # auto: write tasks → cloud (more reliable), read/Q&A → local if available
    if has_write and c_online:  return "claude"
    if o_online:                return "ollama"
    return "claude"
```

**Validate:**
```bash
cd backend
uv run python -c "
import asyncio
from app.services.connectivity import claude_is_online, ollama_is_online
print('claude:', asyncio.run(claude_is_online()))
print('ollama:', asyncio.run(ollama_is_online()))
"
```

---

## Phase 2 — Context Builder

**File:** `backend/app/services/context_builder.py` (~130 lines)

```python
MAX_CONTEXT_CHARS = settings.LOCAL_CONTEXT_TOKENS * 4  # token ≈ 4 chars

async def build_context(
    query: str,
    *,
    workspace_id: UUID | None,
    workspace_path: str | None,
    session_id: str | None,
    db: AsyncSession,
) -> str:
    parts: list[str] = []

    # 1. argomemory LTM recall (đã có trong memory_svc)
    ltm = await memory_svc.recall_context(query, token_budget=1500)
    if ltm:
        parts.append(ltm)

    # 2. Chiron RAG (đã có trong chiron.py)
    if workspace_id:
        chiron = ChironService(db)
        results = await chiron.search(workspace_id, query, top_k=4)
        if results:
            parts.append(_format_rag_results(results))

    # 3. codegraph symbol context (nếu .codegraph/ tồn tại)
    if workspace_path:
        cg = await _codegraph_context(workspace_path, query)
        if cg:
            parts.append(cg)

    # 4. STM session context (resumed session)
    if session_id:
        stm = await memory_svc.get_session_context(
            session_id,
            project=project_name_from_path(workspace_path)
        )
        if stm:
            parts.append(stm)

    combined = "\n\n".join(parts)
    return combined[:MAX_CONTEXT_CHARS]  # hard cap


def _codegraph_context(workspace_path: str, query: str) -> str | None:
    """Query .codegraph/ SQLite for relevant symbols. No-op if not indexed."""
    codegraph_db = Path(workspace_path) / ".codegraph" / "index.db"
    if not codegraph_db.exists():
        return None
    # Simple FTS query against symbol names matching query tokens
    ...
```

**Validate:**
```bash
uv run python -c "
import asyncio
from app.services.context_builder import build_context
# requires DB session + workspace_id from a real workspace
"
```

---

## Phase 3 — Tool Executor

**File:** `backend/app/services/tool_executor.py` (~320 lines)

### Tool Schemas (JSON Schema cho Ollama function calling)

```python
TOOL_SCHEMAS: dict[str, dict] = {
    "Read":  {"type": "function", "function": {
        "name": "Read",
        "description": "Read the contents of a file",
        "parameters": {"type": "object", "properties": {
            "file_path": {"type": "string", "description": "Absolute path to file"}
        }, "required": ["file_path"]}
    }},
    "Write": {...},
    "Edit":  {...},   # old_string + new_string + file_path
    "Bash":  {"type": "function", "function": {
        "name": "Bash",
        "description": "Run a shell command. Avoid destructive operations.",
        "parameters": {"type": "object", "properties": {
            "command": {"type": "string"},
            "timeout": {"type": "integer", "default": 30}
        }, "required": ["command"]}
    }},
    "Grep":  {...},
    "Glob":  {...},
}
```

### Tool Name Normalization (hallucination guard)

```python
_ALIASES: dict[str, str] = {
    "read_file": "Read",   "readfile": "Read",   "read": "Read",
    "write_file": "Write", "writefile": "Write",
    "edit_file": "Edit",   "editfile": "Edit",   "str_replace": "Edit",
    "bash": "Bash",        "shell": "Bash",      "run_command": "Bash",
    "grep": "Grep",        "search_text": "Grep",
    "glob": "Glob",        "find_files": "Glob", "list_files": "Glob",
}

def normalize_tool_name(name: str) -> str | None:
    key = name.lower().replace("-", "_").replace(" ", "_")
    return _ALIASES.get(key) or (name if name in TOOL_SCHEMAS else None)
```

### Execution + Guards

```python
MAX_TOOL_ITERATIONS    = settings.LOCAL_MAX_TOOL_ITERATIONS  # default 20
MAX_BASH_OUTPUT_CHARS  = 8_000
MAX_READ_SIZE_BYTES    = 100_000
MAX_GLOB_RESULTS       = 50
_BLOCKED_BASH_PATTERNS = [r"rm\s+-rf", r"sudo", r"dd\s+if=", r"mkfs", r":(){:|:&};:"]

async def execute_tool(
    name: str,
    arguments: dict,
    *,
    cwd: str | None = None,
) -> str:
    canonical = normalize_tool_name(name)
    if canonical is None:
        return f"[ToolError: unknown tool '{name}'. Available: {list(TOOL_SCHEMAS)}]"
    match canonical:
        case "Read":   return await _exec_read(arguments, cwd)
        case "Write":  return await _exec_write(arguments, cwd)
        case "Edit":   return await _exec_edit(arguments, cwd)
        case "Bash":   return await _exec_bash(arguments, cwd)
        case "Grep":   return await _exec_grep(arguments, cwd)
        case "Glob":   return await _exec_glob(arguments, cwd)


async def _exec_bash(arguments: dict, cwd: str | None) -> str:
    command = arguments.get("command", "")
    timeout = min(int(arguments.get("timeout", 30)), 60)

    # Safety: block destructive patterns
    for pattern in _BLOCKED_BASH_PATTERNS:
        if re.search(pattern, command):
            return f"[ToolError: blocked command pattern '{pattern}']"

    proc = await asyncio.create_subprocess_shell(
        command, stdout=PIPE, stderr=PIPE, cwd=cwd
    )
    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(), timeout=timeout
        )
    except asyncio.TimeoutError:
        proc.kill()
        return f"[ToolError: command timed out after {timeout}s]"

    output = (stdout + stderr).decode(errors="replace")
    if len(output) > MAX_BASH_OUTPUT_CHARS:
        output = output[:MAX_BASH_OUTPUT_CHARS] + f"\n... [truncated {len(output)} chars]"
    return output or "(no output)"
```

### Loop Guard

```python
from collections import Counter

class ToolLoopGuard:
    """Detect and break infinite tool loops."""
    def __init__(self, max_iterations: int = MAX_TOOL_ITERATIONS):
        self._count = 0
        self._call_counts: Counter = Counter()
        self._max = max_iterations

    def check(self, tool_name: str, arguments: dict) -> bool:
        """Return True if loop should continue, False if should break."""
        self._count += 1
        if self._count > self._max:
            return False
        key = f"{tool_name}:{json.dumps(arguments, sort_keys=True)}"
        self._call_counts[key] += 1
        if self._call_counts[key] >= 3:  # same call 3x → infinite loop
            return False
        return True
```

**Validate:**
```bash
uv run python -m pytest backend/tests/services/test_tool_executor.py -v
# Test cases: normalization, Read happy path, Bash timeout,
# Bash blocked pattern, loop guard, context explosion guard
```

---

## Phase 4 — Task Planner

**File:** `backend/app/services/task_planner.py` (~160 lines)

```python
@dataclass
class TaskPlan:
    steps: list[str]
    strategy: str   # "search_first" | "read_first" | "direct"
    estimated_tools: list[str]
    use_planner: bool = True

# Rule-based templates — zero LLM latency, covers ~70% of real tasks
_TEMPLATES: dict[str, TaskPlan] = {
    "debugging": TaskPlan(
        steps=["Search for the error/symbol", "Read relevant files",
               "Diagnose root cause", "Apply fix", "Verify"],
        strategy="search_first",
        estimated_tools=["Grep", "Read", "Edit"],
    ),
    "research": TaskPlan(
        steps=["Search knowledge base and code", "Synthesize findings", "Respond"],
        strategy="search_first",
        estimated_tools=["Grep", "Glob", "Read"],
    ),
    "code_review": TaskPlan(
        steps=["Read target file(s)", "Analyze for issues", "Report findings"],
        strategy="read_first",
        estimated_tools=["Read", "Grep"],
    ),
    "test_writing": TaskPlan(
        steps=["Read implementation", "Write test file", "Run tests"],
        strategy="read_first",
        estimated_tools=["Read", "Write", "Bash"],
    ),
    "frontend_design": TaskPlan(
        steps=["Read existing components", "Plan structure", "Write component", "Verify"],
        strategy="read_first",
        estimated_tools=["Read", "Write", "Glob"],
    ),
    "backend_api": TaskPlan(
        steps=["Read models/schemas", "Plan endpoint", "Write code", "Verify"],
        strategy="read_first",
        estimated_tools=["Read", "Write", "Edit"],
    ),
    "git_ops": TaskPlan(
        steps=["Run git command", "Report result"],
        strategy="direct",
        estimated_tools=["Bash"],
    ),
    "file_ops": TaskPlan(
        steps=["Execute file operation", "Verify result"],
        strategy="direct",
        estimated_tools=["Read", "Write", "Bash"],
    ),
    "memory_ops": TaskPlan(
        steps=["Search memory", "Respond"],
        strategy="direct",
        estimated_tools=[],
        use_planner=False,
    ),
}

def _infer_category(triage: TriageResult) -> str | None:
    """Map triage result back to template key."""
    # Dùng model tier và tool set để infer category
    tool_set = set(triage.allowed_tools)
    if not tool_set & {"Write", "Edit", "Bash"}:
        return "research"
    if "Bash" in tool_set and len(tool_set) <= 3:
        return "git_ops"
    # ... more heuristics
    return None

async def make_plan(message: str, triage: TriageResult) -> TaskPlan:
    category = _infer_category(triage)
    if category and category in _TEMPLATES:
        return _TEMPLATES[category]
    # Fallback: LLM-based plan dùng model nhỏ
    return await _llm_plan(message, triage)

async def _llm_plan(message: str, triage: TriageResult) -> TaskPlan:
    """Ask OLLAMA_PLAN_MODEL to decompose task. Haiku-speed, low cost."""
    ...
```

**Validate:**
```bash
uv run python -c "
import asyncio
from app.services.task_planner import make_plan
from app.services.claude_cli import TriageResult
triage = TriageResult(allowed_tools=['Read','Grep','Glob'])
plan = asyncio.run(make_plan('explain the auth flow', triage))
print(plan)
"
```

---

## Phase 5 — OllamaCodeSession

**File:** `backend/app/services/ollama_session.py` (~280 lines)

```python
class OllamaCodeSession:
    """
    Local model session. Yields CLIEvent — same interface as ClaudeCliSession.

    Key differences from ClaudeCliSession:
    - HTTP API calls instead of subprocess
    - permission_mode always "auto" (no plan gate — local is faster)
    - Explicit tool loop with guards
    - session_id is local UUID (not Claude's session)
    """

    def __init__(self) -> None:
        self.session_id: str | None = None
        self._client: openai.AsyncOpenAI | None = None

    @property
    def client(self) -> openai.AsyncOpenAI:
        if self._client is None:
            import openai
            self._client = openai.AsyncOpenAI(
                base_url=f"{settings.OLLAMA_HOST}/v1",
                api_key="ollama",  # Ollama ignores this but SDK requires it
            )
        return self._client

    async def start(
        self,
        message: str,
        triage: TriageResult,
        *,
        permission_mode: str = "auto",
        session_id: str | None = None,
        system_prompt: str | None = None,
        cwd: str | None = None,
    ) -> AsyncIterator[CLIEvent]:

        self.session_id = session_id or str(uuid.uuid4())

        # Emit system/init (same as ClaudeCliSession)
        yield CLIEvent(
            type="system", subtype="init",
            data={"session_id": self.session_id},
            session_id=self.session_id,
        )

        # Build tool schemas for this triage's allowed tools
        tools = [
            TOOL_SCHEMAS[t]
            for t in triage.allowed_tools
            if t in TOOL_SCHEMAS
        ]

        # Build initial messages with plan preamble
        plan = await make_plan(message, triage)
        user_content = _build_user_message(message, plan)
        messages: list[dict] = [{"role": "user", "content": user_content}]
        guard = ToolLoopGuard(MAX_TOOL_ITERATIONS)

        try:
            while True:
                # Call Ollama
                turn = await self._call_model(
                    messages, tools, system_prompt, triage.model
                )

                # Stream assistant text
                if turn.text:
                    yield CLIEvent(
                        type="assistant", subtype="text",
                        data={}, text=turn.text,
                        session_id=self.session_id,
                    )

                # No tool calls → done
                if turn.finish_reason != "tool_use" or not turn.tool_calls:
                    break

                # Execute each tool call
                results: list[tuple[str, str, Any]] = []
                for tc in turn.tool_calls:
                    if not guard.check(tc.name, tc.arguments):
                        yield CLIEvent(
                            type="assistant", subtype="text", data={},
                            text="\n[Loop guard: max iterations reached]",
                            session_id=self.session_id,
                        )
                        break

                    yield CLIEvent(
                        type="tool_use", subtype=None,
                        data={"tool_use": {"name": tc.name, "input": tc.arguments},
                              "index": len(results)},
                        session_id=self.session_id,
                    )

                    result_text = await execute_tool(tc.name, tc.arguments, cwd=cwd)

                    yield CLIEvent(
                        type="tool_result", subtype=None,
                        data={"tool_result": {"content": result_text},
                              "index": len(results)},
                        session_id=self.session_id,
                    )
                    results.append((tc.id, tc.name, result_text))
                else:
                    # Append turn + results to message history and continue
                    messages.append(assistant_message_from_turn(turn))
                    messages.append(tool_results_message(results))
                    continue
                break  # guard triggered

        except Exception as exc:
            logger.exception("OllamaCodeSession error: %s", exc)
            yield CLIEvent(
                type="error", subtype=None,
                data={"message": str(exc)},
                session_id=self.session_id,
            )
        finally:
            yield CLIEvent(
                type="result", subtype=None,
                data={"usage": {}, "cost_usd": 0.0},
                session_id=self.session_id,
            )

    async def _call_model(
        self,
        messages: list[dict],
        tools: list[dict],
        system: str | None,
        model_tier: str,
    ) -> AssistantTurn:
        """Delegate to openai_provider pattern with Ollama base_url."""
        model_id = (
            settings.OLLAMA_CHAT_MODEL
            if model_tier != "haiku"
            else settings.OLLAMA_PLAN_MODEL
        )
        # Reuse neutral_to_openai_messages + AssistantTurn parsing
        # (exact same code as OpenAILLM.generate_with_tools)
        ...

    async def terminate(self) -> None:
        pass  # HTTP-based, no subprocess
```

**Validate:**
```bash
# Requires Ollama running với qwen2.5-coder:7b (lite model for CI)
uv run python -c "
import asyncio
from app.services.ollama_session import OllamaCodeSession
from app.services.claude_cli import TriageResult

async def test():
    session = OllamaCodeSession()
    triage = TriageResult(allowed_tools=['Read', 'Glob'], model='haiku')
    events = []
    async for event in session.start('list files in current dir', triage, cwd='/tmp'):
        events.append(event)
        print(event.type, event.text or '')
    print('Total events:', len(events))

asyncio.run(test())
"
```

---

## Phase 6 — chat_session.py Patch

**File:** `backend/app/services/chat_session.py` (thêm ~50 lines)

```python
# Thêm vào đầu file
from app.services.connectivity import routing_decision
from app.services.ollama_session import OllamaCodeSession

# Thêm run_local_session() — mirrors run_session() pattern
async def run_local_session(
    message: str,
    triage: TriageResult,
    *,
    session_id: str | None = None,
    permission_mode: str = "auto",
    system_prompt: str | None = None,
    workspace_path: str | None = None,
) -> AsyncIterator[CLIEvent]:
    session = OllamaCodeSession()
    registered_id: str | None = session_id

    try:
        async for event in session.start(
            message, triage,
            permission_mode=permission_mode,
            session_id=session_id,
            system_prompt=system_prompt,
            cwd=workspace_path,
        ):
            if session.session_id and session.session_id not in _active:
                registered_id = session.session_id
                _active[registered_id] = _SessionEntry(
                    session=session,  # type: ignore[arg-type]
                    workspace_path=workspace_path,
                )
                _plan_workspaces[registered_id] = workspace_path

            yield event
            if event.type == "result":
                break
    finally:
        if registered_id and registered_id in _active:
            del _active[registered_id]
        await session.terminate()

# Thêm route_session() — dispatcher
async def route_session(
    message: str,
    triage: TriageResult,
    *,
    session_id: str | None = None,
    permission_mode: str = "plan",
    system_prompt: str | None = None,
    workspace_path: str | None = None,
) -> AsyncIterator[CLIEvent]:
    """Route to ClaudeCliSession or OllamaCodeSession based on connectivity + config."""
    decision = await routing_decision(triage)
    logger.info("route_session: decision=%s mode=%s", decision, settings.ROUTING_MODE)

    if decision == "claude":
        async for event in run_session(
            message, triage,
            session_id=session_id,
            permission_mode=permission_mode,
            system_prompt=system_prompt,
            workspace_path=workspace_path,
        ):
            yield event
    else:
        async for event in run_local_session(
            message, triage,
            session_id=session_id,
            permission_mode="auto",  # local always auto — no confirm gate
            system_prompt=system_prompt,
            workspace_path=workspace_path,
        ):
            yield event
```

---

## Phase 7 — Config + chat.py + .env

### `config.py` additions

```python
# === Local AI Agent ===
OLLAMA_CHAT_MODEL: str = "qwen2.5-coder:32b"   # main coding model
OLLAMA_PLAN_MODEL: str = "qwen2.5-coder:7b"    # lightweight planner
LOCAL_CONTEXT_TOKENS: int = 6_000              # RAG + memory budget
LOCAL_MAX_TOOL_ITERATIONS: int = 20            # infinite loop guard
```

### `chat.py` change (1 line)

```python
# BEFORE
async for event in run_session(body.message, triage, ...):

# AFTER
async for event in route_session(body.message, triage, ...):
```

### `.env.example` additions

```bash
# Local AI Agent
ROUTING_MODE=auto                          # auto|prefer_local|prefer_cloud|force_local|force_cloud
OLLAMA_HOST=http://localhost:11434
OLLAMA_CHAT_MODEL=qwen2.5-coder:32b        # ollama pull qwen2.5-coder:32b
OLLAMA_PLAN_MODEL=qwen2.5-coder:7b         # ollama pull qwen2.5-coder:7b
LOCAL_CONTEXT_TOKENS=6000
LOCAL_MAX_TOOL_ITERATIONS=20
```

---

## Context Builder — Wire vào OllamaCodeSession

Trong `chat.py`, phần build `system_prompt` đã inject Argo persona + tier0/tier1 context.
`build_context()` cần được gọi **thêm** và append vào `system_prompt` trước khi truyền
vào `route_session()`. Điều này đảm bảo local model nhận đủ context mà không thay đổi
flow của Claude path.

```python
# Trong chat.py _stream_response(), sau khi build system_prompt:
if decision == "ollama":  # hoặc check trước khi stream
    local_ctx = await build_context(
        body.message,
        workspace_id=body.workspace_id,
        workspace_path=workspace_path,
        session_id=body.session_id,
        db=db,
    )
    if local_ctx:
        system_prompt = (system_prompt or "") + "\n\n" + local_ctx
```

---

## Ước lượng Lines of Code

| File | Lines | Complexity |
|---|---|---|
| `connectivity.py` | ~70 | Low |
| `context_builder.py` | ~130 | Low (wire existing) |
| `tool_executor.py` | ~320 | **High** (guards, retry, normalization) |
| `task_planner.py` | ~160 | Medium |
| `ollama_session.py` | ~280 | Medium-High |
| `chat_session.py` patch | ~50 | Low |
| `chat.py` patch | ~10 | Low |
| `config.py` patch | ~8 | Low |
| **Tổng** | **~1028** | **Medium-High** |

---

## Risks

| Risk | Khả năng | Mitigation |
|---|---|---|
| Ollama tool calling schema khác OpenAI | Medium | Test với `qwen2.5-coder:7b`, có fallback text parsing |
| Context explosion vẫn xảy ra | Medium | Hard cap `MAX_READ_SIZE_BYTES=100KB`, `MAX_BASH_OUTPUT=8000` |
| Bash path traversal / injection | **High** | Blocked patterns, restrict cwd, no `rm -rf`, no `sudo` |
| Ollama timeout khi model lớn (32B) | Low-Medium | `httpx.timeout=120s`, async stream |
| `routing_decision()` probe chậm | Low | TTL cache (60s Claude, 30s Ollama), asyncio.gather |
| Plan templates không match task | Medium | LLM fallback + graceful degrade |
| Model hallucinate non-existent tool | Medium | `normalize_tool_name()` + return error string (không crash) |

---

## Acceptance Criteria

- [ ] `ROUTING_MODE=force_local` → toàn bộ chat dùng Ollama, không gọi Claude CLI
- [ ] `ROUTING_MODE=force_cloud` → behavior không thay đổi so với hiện tại
- [ ] `ROUTING_MODE=auto` + Ollama offline → fallback về Claude tự động
- [ ] Tool `Read` đọc đúng file, truncate nếu > 100KB
- [ ] Tool `Bash` có timeout 30s, truncate output > 8000 chars
- [ ] Bash blocked patterns: `rm -rf`, `sudo`, `dd if=` không execute được
- [ ] Infinite loop bị break sau `MAX_TOOL_ITERATIONS=20`
- [ ] Context Builder inject Chiron results vào system_prompt
- [ ] Memory recall inject LTM context vào system_prompt
- [ ] Frontend không thay đổi — CLIEvent format giữ nguyên
- [ ] `uv run pytest backend/tests/services/test_tool_executor.py` pass

---

## Validation Commands

```bash
cd backend

# 1. Check connectivity detection
uv run python -c "
import asyncio
from app.services.connectivity import claude_is_online, ollama_is_online, routing_decision
from app.services.claude_cli import TriageResult
triage = TriageResult(allowed_tools=['Read','Grep'])
print('claude:', asyncio.run(claude_is_online()))
print('ollama:', asyncio.run(ollama_is_online()))
print('decision:', asyncio.run(routing_decision(triage)))
"

# 2. Check tool executor
uv run python -c "
import asyncio
from app.services.tool_executor import execute_tool, normalize_tool_name
print(normalize_tool_name('read_file'))   # → 'Read'
print(normalize_tool_name('ReadFile'))    # → 'Read'
print(normalize_tool_name('unknown'))     # → None
result = asyncio.run(execute_tool('Read', {'file_path': '/tmp/test.txt'}))
print(result[:200])
"

# 3. End-to-end local session (requires Ollama)
ROUTING_MODE=force_local uv run python -c "
import asyncio
from app.services.ollama_session import OllamaCodeSession
from app.services.claude_cli import TriageResult

async def test():
    s = OllamaCodeSession()
    triage = TriageResult(allowed_tools=['Read', 'Glob'], model='haiku')
    async for ev in s.start('What files are in /tmp?', triage, cwd='/tmp'):
        print(f'[{ev.type}] {(ev.text or \"\")[:80]}')
asyncio.run(test())
"

# 4. Run full test suite
uv run pytest backend/tests/ -v --tb=short
```

---

## Setup Ollama (prerequisite)

```bash
# Install Ollama (nếu chưa có)
curl -fsSL https://ollama.ai/install.sh | sh

# Pull models
ollama pull qwen2.5-coder:7b    # 4.7GB — planner + fast tasks
ollama pull qwen2.5-coder:32b   # 19GB — main coding model (cần 24GB RAM)

# Hoặc dùng model nhỏ hơn cho M2 Pro (16GB RAM)
ollama pull qwen2.5-coder:14b   # 9GB — good balance

# Verify
ollama list
curl http://localhost:11434/api/tags
```

---

## Rollback Plan

Tất cả thay đổi là **additive** — không xóa hay thay thế code hiện có:

```bash
# Revert hoàn toàn bằng env var
ROUTING_MODE=force_cloud  # chat.py route_session() → run_session() → ClaudeCliSession

# Hoặc revert 1 dòng trong chat.py
# route_session() → run_session()
```

---

## Ghi chú kỹ thuật

### Tại sao không dùng `ClaudeCliSession` interface thẳng với Ollama?

`ClaudeCliSession` spawn subprocess của `claude` binary với `--output-format stream-json`.
Format này là proprietary của Claude Code CLI. Ollama dùng OpenAI-compatible REST API.
Cần wrapper riêng nhưng yield **cùng CLIEvent format** để frontend không cần thay đổi.

### Tại sao permission_mode luôn là "auto" cho local?

Plan gate (`permission_mode=plan`) yêu cầu user confirm trước khi execute. Với local model:
1. Model nhỏ hơn → plan chất lượng thấp hơn → user confirm nhưng không biết đúng không
2. Latency đã cao → thêm confirm step làm UX tệ hơn
3. Offline use case → user cần kết quả ngay

Thay vào đó, tool loop có guard riêng và mọi destructive operations bị block ở `tool_executor.py`.

### Context window budget

```
System prompt (Argo persona):     ~200 tokens
RAG context (Chiron):             ~1500 tokens
Memory LTM:                       ~1500 tokens
STM session context:              ~1000 tokens
Plan preamble:                    ~300 tokens
──────────────────────────────────────────────
Total system context:             ~4500 tokens
Remaining for conversation:       ~27500 tokens (qwen2.5-coder:32b context=32k)
```
