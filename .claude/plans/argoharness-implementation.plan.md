# ArgoHarness — Implementation Plan

**Date:** 2026-06-02  
**Status:** `pending`  
**Complexity:** Large  
**Depends on:** Local AI Agent stack (local-ai-agent.plan.md — completed)

---

## Tổng quan

ArgoHarness là lớp kiểm soát bao quanh cả local model (Ollama) và cloud model (Claude CLI) trong Argo — không thay đổi model, nhưng cải thiện độ chính xác, độ tin cậy, và chất lượng output thông qua:

1. **Skill Injector** — inject ArgoHarness methodology skills vào system prompt theo task category
2. **Model Tier Selector** — dynamic routing sang đúng model tier (qwen:0.5b → qwen:3b → gemma4:31b → Claude)
3. **Gemma4 Native Integration** — tận dụng 262K context + native tool calling + thinking mode
4. **Verification Gate** — judge model scoring + retry logic trước khi trả kết quả
5. **User Model Selector** — cho phép user chọn model qua UI thay vì hardcode env var

---

## Skills đã được chuẩn bị

```
.claude/skills/argoharness/           ← 13 skills, 39 files, đã rename hoàn tất
├── brainstorming/                    Design before code
├── systematic-debugging/             Root cause before fixes
├── verification-before-completion/   Evidence before claims
├── writing-plans/                    Implementation planning
├── subagent-driven-development/      Multi-agent review cycle
├── executing-plans/                  Sequential plan execution
├── finishing-a-development-branch/   Test verify + merge
├── test-driven-development/          TDD workflow
├── requesting-code-review/           Code review process
├── receiving-code-review/            Processing reviews
├── dispatching-parallel-agents/      Parallel agent dispatch
├── using-git-worktrees/              Git worktree management
└── using-argoharness/                Meta-skill (từ using-superpowers)
```

---

## Codebase Patterns (grounding)

| Category | Source | Pattern |
|---|---|---|
| System prompt inject | `chat.py:289` | `parts.append(...)` → `"\n\n".join(parts)` |
| Triage category | `triage.py:150` | `_layer1_classify()` → `category: str` |
| Session dispatch | `chat_session.py:route_session()` | `decision = await routing_decision(triage)` |
| Config fields | `config.py:152-156` | `OLLAMA_CHAT_MODEL`, `LOCAL_CONTEXT_TOKENS` pattern |
| Ollama API call | `ollama_session.py:236` | `_call_model()` — OpenAI SDK, base_url=OLLAMA_HOST |
| Tool calling | `ollama_session.py:267` | `msg.tool_calls` → parse → `execute_tool()` |
| CLIEvent format | `claude_cli.py:72` | `CLIEvent(type, subtype, data, session_id, text)` |

---

## Dependency Graph

```
Phase 1: config.py update              ← không deps
Phase 2: skill_injector.py             ← skill files đã có, cần config.py
Phase 3: model_tier_selector.py        ← cần config.py
Phase 4: verification_gate.py          ← cần config.py
Phase 5: gemma4 integration            ← cần Phase 3
  5a: ollama_session.py update         ← cần Phase 2, 3, 4
  5b: structured output cho gemma4
Phase 6: user model selector           ← cần Phase 3 + provider_configs DB
Phase 7: wire vào chat.py              ← cần Phase 2, 3, 4, 5
Phase 8: docs/argoharness/ scaffold    ← độc lập
```

---

## Files to Change

| File | Action | Lý do |
|---|---|---|
| `backend/app/core/config.py` | **UPDATE** | Thêm model tier settings, skill dir path, judge model |
| `backend/app/services/skill_injector.py` | **CREATE** | Map triage category → skill SKILL.md content |
| `backend/app/services/model_tier_selector.py` | **CREATE** | Dynamic model selection: 0.5b/3b/gemma4/Claude |
| `backend/app/services/verification_gate.py` | **CREATE** | Judge model scoring + retry logic |
| `backend/app/services/ollama_session.py` | **UPDATE** | Wire skill_injector + tier selector + verification + Gemma4 |
| `backend/app/api/routes/v1/chat.py` | **UPDATE** | Inject skill content vào system_prompt |
| `backend/app/api/routes/v1/providers.py` | **UPDATE** | Expose available local models list |
| `frontend/src/components/providers/ModelSelector.jsx` | **UPDATE** | Hiển thị + cho chọn local models |
| `docs/argoharness/` | **CREATE** | Scaffold directory cho plans + specs |
| `backend/.env.example` | **UPDATE** | Document new harness settings |

---

## Phase 1 — Config Update

**File:** `backend/app/core/config.py`

```python
# === ArgoHarness ===
ARGOHARNESS_SKILLS_DIR: str = ""  # auto-resolved at startup to .claude/skills/argoharness/

# Model tiers — override via env for different hardware configurations
OLLAMA_TIER0_MODEL: str = "qwen2.5:0.5b"      # judge / scorer (397MB)
OLLAMA_TIER1_MODEL: str = "qwen2.5-coder:3b"   # fast Q&A (1.9GB)
OLLAMA_TIER2_MODEL: str = "gemma4:31b-cloud"   # primary coder (BF16, 262K ctx)
# OLLAMA_TIER3: Claude CLI (existing)

HARNESS_JUDGE_MODEL: str = "qwen2.5:0.5b"        # verification gate model
HARNESS_VERIFICATION_THRESHOLD: int = 7           # min score (0-10) to accept output
HARNESS_MAX_RETRIES: int = 2                      # max retry attempts before escalate
HARNESS_SKILL_INJECTION_ENABLED: bool = True      # master toggle for skill injection
HARNESS_VERIFICATION_ENABLED: bool = True         # master toggle for verification gate
HARNESS_GEMMA4_THINKING_ENABLED: bool = True      # enable gemma4 thinking mode

@field_validator("ARGOHARNESS_SKILLS_DIR", mode="after")
@classmethod
def resolve_skills_dir(cls, v: str) -> str:
    if v:
        return v
    # Auto-resolve to repo root .claude/skills/argoharness/
    from pathlib import Path
    import shutil
    # Walk up from this file to find repo root (.claude directory)
    current = Path(__file__).resolve()
    for parent in [current, *current.parents]:
        skills_dir = parent / ".claude" / "skills" / "argoharness"
        if skills_dir.exists():
            return str(skills_dir)
    return ""
```

**Validate:**
```bash
cd backend
uv run python -c "
from app.core.config import settings
print('Skills dir:', settings.ARGOHARNESS_SKILLS_DIR)
print('Tier0:', settings.OLLAMA_TIER0_MODEL)
print('Tier2:', settings.OLLAMA_TIER2_MODEL)
assert settings.ARGOHARNESS_SKILLS_DIR.endswith('argoharness')
print('PASS')
"
```

---

## Phase 2 — Skill Injector

**File:** `backend/app/services/skill_injector.py` (~110 lines)

```python
"""ArgoHarness Skill Injector.

Maps triage category → ArgoHarness skill content for system prompt injection.
Skills guide the model to follow methodology patterns (root cause first,
verify before claiming done, plan before coding, etc.)
"""

SKILL_CATEGORY_MAP: dict[str, str] = {
    # Debugging: systematic root cause investigation before any fix
    "debugging":        "systematic-debugging",
    # Complex features: design before code
    "backend_api":      "brainstorming",
    "frontend_design":  "brainstorming",
    "general_coding":   "verification-before-completion",
    # Testing: TDD red-green-refactor
    "test_writing":     "test-driven-development",
    # Planning: bite-sized task decomposition
    # (injected for multi-file tasks detected by tool count)
    "_multi_file":      "writing-plans",
    # Code review
    "code_review":      "requesting-code-review",
}

def get_skill_content(category: str, triage: TriageResult) -> str | None:
    """Return SKILL.md content for this category, or None if not applicable."""
    if not settings.HARNESS_SKILL_INJECTION_ENABLED:
        return None
    if not settings.ARGOHARNESS_SKILLS_DIR:
        return None
    
    # Multi-file heuristic: if many write tools + sonnet, inject writing-plans
    tool_set = set(triage.allowed_tools)
    write_heavy = bool({"Write", "Edit"} & tool_set) and len(tool_set) > 4
    effective_category = "_multi_file" if write_heavy else category
    
    skill_name = SKILL_CATEGORY_MAP.get(effective_category)
    if not skill_name:
        skill_name = SKILL_CATEGORY_MAP.get(category)
    if not skill_name:
        return None
    
    skill_path = Path(settings.ARGOHARNESS_SKILLS_DIR) / skill_name / "SKILL.md"
    if not skill_path.exists():
        return None
    
    content = skill_path.read_text(encoding="utf-8")
    return f"[ArgoHarness Methodology: {skill_name}]\n{content}\n[End Methodology]"
```

**Validate:**
```bash
uv run python -c "
from app.services.skill_injector import get_skill_content
from app.services.claude_cli import TriageResult

t = TriageResult(allowed_tools=['Read','Edit','Bash'], model='sonnet', effort='high')
content = get_skill_content('debugging', t)
assert content is not None
assert 'Root Cause' in content
assert 'argoharness' in content
print('debugging skill:', content[:60])
print('PASS')
"
```

---

## Phase 3 — Model Tier Selector

**File:** `backend/app/services/model_tier_selector.py` (~90 lines)

```python
"""Dynamic model tier selection for OllamaCodeSession.

Tier system:
  Tier 0: qwen2.5:0.5b       — judge/scorer only (never for coding)
  Tier 1: qwen2.5-coder:3b   — fast Q&A, explain, read-only
  Tier 2: gemma4:31b-cloud   — complex coding, tool chains, 262K context
  Tier 3: Claude CLI          — escalation (handled by routing_decision)

Selection logic:
  - context_chars > 8000  → Tier 2 (gemma4 handles large context)
  - has write tools        → Tier 2 (more reliable tool calling)
  - read-only + haiku      → Tier 1 (fast, cheap)
  - default                → Tier 1
"""

@dataclass
class ModelTierSelection:
    model_id: str
    tier: int           # 0-3
    supports_thinking: bool
    context_window: int

def select_model_tier(
    triage: TriageResult,
    context_chars: int = 0,
    user_override: str | None = None,  # from user UI selection
) -> ModelTierSelection:
    
    # User override from UI (stored in provider_configs or session)
    if user_override and user_override in _KNOWN_MODELS:
        spec = _KNOWN_MODELS[user_override]
        return ModelTierSelection(model_id=user_override, **spec)
    
    tool_set = set(triage.allowed_tools)
    has_write = bool({"Write", "Edit", "Bash"} & tool_set)
    is_simple = triage.model == "haiku" and not has_write
    large_context = context_chars > 8000
    
    # Gemma4 for complex or large-context tasks
    if has_write or large_context or triage.effort == "high":
        return ModelTierSelection(
            model_id=settings.OLLAMA_TIER2_MODEL,
            tier=2,
            supports_thinking=settings.HARNESS_GEMMA4_THINKING_ENABLED,
            context_window=262144,
        )
    
    # Fast model for simple tasks
    return ModelTierSelection(
        model_id=settings.OLLAMA_TIER1_MODEL,
        tier=1,
        supports_thinking=False,
        context_window=32768,
    )

# Known model metadata for UI display
_KNOWN_MODELS: dict[str, dict] = {
    "qwen2.5-coder:3b":   {"tier": 1, "supports_thinking": False, "context_window": 32768},
    "qwen2.5-coder:7b":   {"tier": 1, "supports_thinking": False, "context_window": 32768},
    "qwen2.5-coder:32b":  {"tier": 2, "supports_thinking": False, "context_window": 32768},
    "gemma4:31b-cloud":   {"tier": 2, "supports_thinking": True,  "context_window": 262144},
    "deepseek-coder:6.7b":{"tier": 1, "supports_thinking": False, "context_window": 16384},
    "llama3.1:latest":    {"tier": 1, "supports_thinking": False, "context_window": 131072},
}
```

**Validate:**
```bash
uv run python -c "
from app.services.model_tier_selector import select_model_tier
from app.services.claude_cli import TriageResult

# Simple Q&A → tier 1
t1 = TriageResult(allowed_tools=['Read','Grep'], model='haiku')
s1 = select_model_tier(t1)
assert s1.tier == 1
print(f'Q&A: tier={s1.tier} model={s1.model_id}')

# Complex write → tier 2 (gemma4)
t2 = TriageResult(allowed_tools=['Read','Write','Edit','Bash'], model='sonnet', effort='high')
s2 = select_model_tier(t2)
assert s2.tier == 2
assert 'gemma4' in s2.model_id
print(f'Write: tier={s2.tier} model={s2.model_id}')

# User override
s3 = select_model_tier(t1, user_override='deepseek-coder:6.7b')
assert s3.model_id == 'deepseek-coder:6.7b'
print(f'Override: {s3.model_id}')
print('PASS')
"
```

---

## Phase 4 — Verification Gate

**File:** `backend/app/services/verification_gate.py` (~120 lines)

```python
"""Verification Gate — judge model scores output quality before returning.

Uses the smallest available model (qwen2.5:0.5b, 397MB) as a fast judge.
Trigger conditions (configurable):
  - Local model session only (Claude is trusted)
  - Output > 100 chars (skip for trivial responses)
  - Task had tool calls (complex execution path)

Score 0-10:
  ≥ HARNESS_VERIFICATION_THRESHOLD (default 7): accept
  < threshold: retry with feedback injected
  max HARNESS_MAX_RETRIES reached: accept anyway (avoid infinite loop)
"""

@dataclass
class VerificationResult:
    score: int          # 0-10
    feedback: str       # issue description if score < threshold
    accepted: bool      # True if score >= threshold

async def verify_output(
    task: str,
    output: str,
    had_tool_calls: bool = False,
) -> VerificationResult:
    if not settings.HARNESS_VERIFICATION_ENABLED:
        return VerificationResult(score=10, feedback="", accepted=True)
    
    # Skip verification for short outputs (greetings, one-liners)
    if len(output) < 100 and not had_tool_calls:
        return VerificationResult(score=10, feedback="", accepted=True)
    
    try:
        score, feedback = await _judge(task, output)
        accepted = score >= settings.HARNESS_VERIFICATION_THRESHOLD
        return VerificationResult(score=score, feedback=feedback, accepted=accepted)
    except Exception as exc:
        logger.warning("Verification gate failed (non-fatal): %s", exc)
        return VerificationResult(score=10, feedback="", accepted=True)

async def _judge(task: str, output: str) -> tuple[int, str]:
    """Ask judge model to score the output."""
    import openai
    client = openai.AsyncOpenAI(
        base_url=f"{settings.OLLAMA_HOST.rstrip('/')}/v1",
        api_key="ollama",
        timeout=15.0,
    )
    prompt = (
        f"Task: {task[:300]}\n\n"
        f"Output:\n{output[:600]}\n\n"
        f"Does this output correctly and completely address the task? "
        f"Reply with JSON only, no other text: "
        f'{{\"score\": 0-10, \"issue\": \"brief description or empty string\"}}'
    )
    resp = await client.chat.completions.create(
        model=settings.HARNESS_JUDGE_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=80,
        temperature=0.0,
        response_format={"type": "json_object"},
    )
    return _parse_score(resp.choices[0].message.content or "")

def _parse_score(raw: str) -> tuple[int, str]:
    try:
        import json
        d = json.loads(raw)
        score = max(0, min(10, int(d.get("score", 7))))
        feedback = str(d.get("issue", ""))
        return score, feedback
    except Exception:
        return 7, ""  # safe default
```

**Validate:**
```bash
uv run python -c "
import asyncio
from app.services.verification_gate import verify_output

async def test():
    # Short output → skip verification
    r1 = await verify_output('hello', 'Hi there!', had_tool_calls=False)
    assert r1.accepted == True
    print(f'Short output: score={r1.score} accepted={r1.accepted}')
    
    # Judge a real output (requires qwen2.5:0.5b in Ollama)
    r2 = await verify_output(
        'List Python files in /tmp',
        'There are no Python files in /tmp directory.',
        had_tool_calls=True
    )
    print(f'Real output: score={r2.score} feedback={r2.feedback!r} accepted={r2.accepted}')
    print('PASS')

asyncio.run(test())
"
```

---

## Phase 5 — Gemma4 + OllamaCodeSession Update

**File:** `backend/app/services/ollama_session.py` (updates to existing)

### 5a — Wire Skill Injector + Tier Selector + Verification Gate

```python
# Trong OllamaCodeSession.start():

# --- Skill injection ---
from app.services.skill_injector import get_skill_content
from app.services.triage import _infer_category  # reuse existing
category = _infer_category(triage) or "general_coding"
skill_content = get_skill_content(category, triage)
if skill_content:
    system_prompt = (system_prompt + "\n\n" + skill_content) if system_prompt else skill_content

# --- Model tier selection (replaces hardcoded model_id) ---
from app.services.model_tier_selector import select_model_tier
context_chars = len(system_prompt or "")
tier = select_model_tier(triage, context_chars=context_chars, user_override=user_model)
model_id = tier.model_id

# --- Verification gate (after tool loop) ---
from app.services.verification_gate import verify_output
final_text = "".join(text_chunks)
retries = 0
while retries < settings.HARNESS_MAX_RETRIES:
    result = await verify_output(message, final_text, had_tool_calls=bool(tool_names_used))
    if result.accepted:
        break
    # Inject feedback and retry
    messages.append({"role": "user", "content": f"[Revision needed: {result.feedback}]. Please correct your response."})
    # Re-run the model (abbreviated loop — no tools, just text correction)
    turn = await self._call_model(messages, [], system_prompt, model_id)
    if turn.text:
        final_text = turn.text
    retries += 1
```

### 5b — Gemma4 Native Tool Calling + Thinking Mode

```python
# Trong _call_model():

# Thinking mode for gemma4 on complex tasks
if "gemma4" in model_id and tier.supports_thinking and triage.effort == "high":
    kwargs["options"] = {"think": True}  # Ollama gemma4 thinking param

# Skip text-based fallback for gemma4 (native tool calling confirmed)
if not tool_calls and text and "gemma4" not in model_id:
    parsed = _extract_text_tool_calls(text)
    if parsed:
        tool_calls = parsed
        text = None
```

**Validate:**
```bash
uv run python -c "
import asyncio
from app.services.ollama_session import OllamaCodeSession
from app.services.claude_cli import TriageResult

async def test():
    session = OllamaCodeSession()
    # Complex write task → should select gemma4
    triage = TriageResult(allowed_tools=['Read','Write','Edit','Bash'], model='sonnet', effort='high')
    
    events = []
    async for ev in session.start(
        'Read /tmp and tell me how many files exist.',
        triage, cwd='/tmp'
    ):
        events.append(ev)
    
    assert events[0].type == 'system'
    assert events[-1].type == 'result'
    assert not any(e.type == 'error' for e in events)
    
    text = [e.text for e in events if e.type == 'assistant' and e.text]
    print(f'Response: {text[-1][:100] if text else \"(none)\"}')
    print(f'Events: {len(events)}, types: {sorted(set(e.type for e in events))}')
    print('PASS')

asyncio.run(test())
"
```

---

## Phase 6 — User Model Selector

### Backend — expose available models

**File:** `backend/app/api/routes/v1/providers.py` (add endpoint)

```python
@router.get("/local-models")
async def list_local_models() -> dict:
    """List available Ollama models with tier metadata."""
    from app.services.model_tier_selector import _KNOWN_MODELS
    from app.services.connectivity import ollama_is_online
    
    if not await ollama_is_online():
        return {"available": False, "models": []}
    
    # Fetch from Ollama API
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(f"{settings.OLLAMA_HOST}/api/tags")
    
    installed = {m["name"] for m in resp.json().get("models", [])}
    
    models = []
    for model_id, meta in _KNOWN_MODELS.items():
        if meta["tier"] == 0:  # skip judge model from UI
            continue
        models.append({
            "id": model_id,
            "tier": meta["tier"],
            "installed": model_id in installed,
            "context_window": meta["context_window"],
            "supports_thinking": meta["supports_thinking"],
            "label": _model_label(model_id),
        })
    
    # Add any installed models not in known list
    for name in installed:
        if name not in _KNOWN_MODELS and not name.startswith("nomic"):
            models.append({"id": name, "tier": 1, "installed": True, 
                          "context_window": 32768, "supports_thinking": False,
                          "label": name})
    
    return {
        "available": True,
        "models": sorted(models, key=lambda m: (not m["installed"], m["tier"], m["id"]))
    }
```

### Frontend — ModelSelector update

**File:** `frontend/src/components/providers/ModelSelector.jsx`

Thêm dropdown "Local Model" bên cạnh "Claude Sonnet 4.6":
- Fetch `/api/v1/providers/local-models`
- Hiển thị installed models với tier badge
- Lưu selection vào localStorage `local_model_override`
- Pass `user_model` vào chat request body

---

## Phase 7 — Wire vào chat.py

**File:** `backend/app/api/routes/v1/chat.py`

```python
# Trong ChatStreamRequest thêm optional field:
class ChatStreamRequest(BaseModel):
    message: str
    session_id: str | None = None
    workspace_id: UUID | None = None
    permission_mode: Literal["plan", "auto"] = "plan"
    coworker_id: UUID | None = None
    user_model: str | None = None  # ← MỚI: user-selected local model

# Trong _stream_response():
# Pass user_model vào run_local_session (Phase 5 wire)
async for event in run_local_session(
    message, triage,
    session_id=session_id,
    permission_mode="auto",
    system_prompt=system_prompt,
    workspace_path=workspace_path,
    user_model=body.user_model,  # ← MỚI
):
    yield event
```

---

## Phase 8 — docs/argoharness/ Scaffold

```
docs/
└── argoharness/
    ├── README.md          ← Giải thích ArgoHarness là gì, cách dùng
    ├── plans/             ← Writing-plans skill lưu plans vào đây
    └── specs/             ← Brainstorming skill lưu specs vào đây
```

---

## Ước lượng Lines of Code

| File | Lines | Complexity |
|---|---|---|
| `config.py` update | ~25 | Low |
| `skill_injector.py` | ~110 | Low-Medium |
| `model_tier_selector.py` | ~90 | Low |
| `verification_gate.py` | ~120 | Medium |
| `ollama_session.py` updates | ~60 | Medium |
| `providers.py` endpoint | ~50 | Low |
| `ModelSelector.jsx` update | ~80 | Low-Medium |
| `docs/argoharness/` scaffold | ~30 | Low |
| **Tổng mới** | **~565** | **Medium** |

---

## Risks

| Risk | Khả năng | Mitigation |
|---|---|---|
| `qwen2.5:0.5b` judge tệ | Medium | Fallback: accept nếu judge fail |
| Gemma4 thinking mode slow | Low-Medium | Toggle `HARNESS_GEMMA4_THINKING_ENABLED=false` |
| Skill content quá dài → context overflow | Low | Trim skill content đến 3000 chars |
| Verification loop vô tận | Low | `HARNESS_MAX_RETRIES=2` hard ceiling |
| User chọn model không có | Medium | Check `installed: true` trong UI trước khi cho chọn |

---

## Acceptance Criteria

- [ ] `ARGOHARNESS_SKILLS_DIR` auto-resolve về `.claude/skills/argoharness/` đúng
- [ ] `skill_injector.get_skill_content("debugging", triage)` trả `systematic-debugging` SKILL.md
- [ ] Triage `debugging` + write tools → gemma4:31b-cloud được select
- [ ] Triage `research` + read-only → qwen2.5-coder:3b được select
- [ ] `verification_gate.verify_output()` gọi qwen2.5:0.5b và trả score
- [ ] OllamaCodeSession với `effort=high` → gemma4 được dùng, skill injected vào system_prompt
- [ ] GET `/api/v1/providers/local-models` trả danh sách models với `installed` flag
- [ ] Frontend ModelSelector hiển thị local models, selection được pass qua chat request
- [ ] `HARNESS_SKILL_INJECTION_ENABLED=false` → không inject skill (master toggle)
- [ ] `HARNESS_VERIFICATION_ENABLED=false` → skip verification gate
- [ ] Zero thay đổi với Claude CLI path (`ROUTING_MODE=force_cloud`)
- [ ] docs/argoharness/plans/ và specs/ directories tồn tại

---

## Validation Commands

```bash
cd backend

# Phase 1: Config
uv run python -c "
from app.core.config import settings
assert settings.ARGOHARNESS_SKILLS_DIR.endswith('argoharness'), f'FAIL: {settings.ARGOHARNESS_SKILLS_DIR}'
print('Config: PASS')
"

# Phase 2: Skill Injector  
uv run python -c "
from app.services.skill_injector import get_skill_content
from app.services.claude_cli import TriageResult
content = get_skill_content('debugging', TriageResult(allowed_tools=['Read','Edit','Bash'], model='sonnet', effort='high'))
assert content and 'Root Cause' in content
print('Skill Injector: PASS')
"

# Phase 3: Model Tier Selector
uv run python -c "
from app.services.model_tier_selector import select_model_tier
from app.services.claude_cli import TriageResult
t = TriageResult(allowed_tools=['Read','Write','Edit'], model='sonnet', effort='high')
s = select_model_tier(t)
assert s.tier == 2 and 'gemma4' in s.model_id
print('Model Tier: PASS')
"

# Phase 4: Verification Gate
uv run python -c "
import asyncio
from app.services.verification_gate import verify_output
r = asyncio.run(verify_output('test', 'hi', had_tool_calls=False))
assert r.accepted
print('Verification Gate: PASS')
"

# Integration: force_local với gemma4
HARNESS_SKILL_INJECTION_ENABLED=true ROUTING_MODE=force_local uv run python -c "
import asyncio
from app.services.ollama_session import OllamaCodeSession
from app.services.claude_cli import TriageResult
# ... full session test
"
```

---

## Rollback

Mọi component đều có master toggle trong config:

```bash
HARNESS_SKILL_INJECTION_ENABLED=false   # tắt skill injection
HARNESS_VERIFICATION_ENABLED=false      # tắt verification gate
OLLAMA_TIER2_MODEL=qwen2.5-coder:3b    # fallback khỏi gemma4
ROUTING_MODE=force_cloud                # bypass toàn bộ local stack
```

Zero breaking changes với Claude CLI path.
