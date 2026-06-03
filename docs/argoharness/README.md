# ArgoHarness

ArgoHarness là lớp kiểm soát methodology bao quanh AI models trong Argo.

## Skills

Skills nằm tại `.claude/skills/argoharness/` — được inject vào system prompt dựa trên task category:

| Skill | Khi nào inject |
|---|---|
| `systematic-debugging` | Task = debugging/bug fix |
| `verification-before-completion` | Mọi coding task |
| `test-driven-development` | Task = viết tests |
| `brainstorming` | Complex feature (backend/frontend) |
| `writing-plans` | Multi-file write task |
| `requesting-code-review` | Task = code review |

## Directories

- `plans/` — Implementation plans (từ `writing-plans` skill)
- `specs/` — Design specs (từ `brainstorming` skill)

## Config

```bash
HARNESS_SKILL_INJECTION_ENABLED=true   # master toggle
HARNESS_VERIFICATION_ENABLED=true      # verification gate
OLLAMA_TIER2_MODEL=gemma4:31b-cloud    # primary local coder
HARNESS_JUDGE_MODEL=qwen2.5:0.5b      # scoring model
```
