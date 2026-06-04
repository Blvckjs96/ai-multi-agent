"""ArgoHarness Skill Injector.

Maps triage task category → ArgoHarness methodology skill content for
injection into the model's system prompt. Skills guide the model to follow
battle-tested engineering patterns without needing to be fine-tuned:

  debugging      → systematic-debugging   (root cause before any fix)
  test_writing   → test-driven-development (red-green-refactor)
  backend_api    → brainstorming           (design before code)
  frontend_design→ brainstorming           (design before code)
  code_review    → requesting-code-review  (structured review template)
  general_coding → verification-before-completion (evidence before claims)
  multi-file     → writing-plans           (bite-sized task decomposition)

Skills are loaded from ARGOHARNESS_SKILLS_DIR at call time (not module load)
so the path validator in config.py has time to run first.

Master toggle: HARNESS_SKILL_INJECTION_ENABLED=false disables all injection.
"""

from __future__ import annotations

import logging
from pathlib import Path

from app.core.config import settings
from app.services.claude_cli import TriageResult

logger = logging.getLogger(__name__)

# Maximum chars of skill content to inject — prevents context explosion.
_MAX_SKILL_CHARS = 3_000

# Map triage category → ArgoHarness skill directory name.
_CATEGORY_SKILL_MAP: dict[str, str] = {
    "debugging":        "systematic-debugging",
    "test_writing":     "test-driven-development",
    "code_review":      "requesting-code-review",
    "backend_api":      "brainstorming",
    "frontend_design":  "brainstorming",
    "general_coding":   "verification-before-completion",
    "devops":           "verification-before-completion",
    "git_ops":          "verification-before-completion",
    # Multi-file write tasks — overrides category when heuristic fires
    "_multi_file":      "writing-plans",
}

# Write tools that signal a complex multi-file task
_WRITE_TOOLS: frozenset[str] = frozenset({"Write", "Edit", "MultiEdit"})


def get_skill_content(category: str, triage: TriageResult) -> str | None:
    """Return trimmed SKILL.md content for this task, or None.

    Injection is skipped when:
    - HARNESS_SKILL_INJECTION_ENABLED is False
    - ARGOHARNESS_SKILLS_DIR is not resolved
    - No skill is mapped for this category
    - The skill file does not exist on disk
    """
    if not settings.HARNESS_SKILL_INJECTION_ENABLED:
        return None

    skills_dir = settings.ARGOHARNESS_SKILLS_DIR
    if not skills_dir:
        logger.debug("skill_injector: ARGOHARNESS_SKILLS_DIR not set — skipping")
        return None

    # Multi-file heuristic: prefer writing-plans when triage has both Write AND
    # Edit (strongly implies multi-file modification) plus at least 5 tools.
    # Requiring both Write+Edit prevents simple Q&A (which may include Write
    # for completeness) from triggering the heavier planning skill.
    tool_set = set(triage.allowed_tools)
    is_multi_file = (
        {"Write", "Edit"}.issubset(tool_set)
        and len(tool_set) >= 5
        and triage.effort in ("normal", "high")
        and triage.model == "sonnet"  # only sonnet-tier warrants full planning
    )
    effective_category = "_multi_file" if is_multi_file else category

    skill_name = _CATEGORY_SKILL_MAP.get(effective_category)
    if not skill_name:
        skill_name = _CATEGORY_SKILL_MAP.get(category)
    if not skill_name:
        logger.debug("skill_injector: no skill mapped for category=%s", category)
        return None

    skill_path = Path(skills_dir) / skill_name / "SKILL.md"
    if not skill_path.exists():
        logger.warning("skill_injector: skill file missing: %s", skill_path)
        return None

    try:
        raw = skill_path.read_text(encoding="utf-8")
    except OSError as exc:
        logger.warning("skill_injector: cannot read %s: %s", skill_path, exc)
        return None

    # Strip YAML frontmatter (--- ... ---)
    content = _strip_frontmatter(raw)

    # Trim to budget to avoid crowding out RAG context
    if len(content) > _MAX_SKILL_CHARS:
        content = content[:_MAX_SKILL_CHARS] + "\n… [skill truncated for context budget]"

    logger.info(
        "skill_injector: injecting %s (%d chars) for category=%s",
        skill_name,
        len(content),
        category,
    )
    return f"[ArgoHarness Methodology — {skill_name}]\n{content}\n[End Methodology]"


def list_available_skills() -> list[str]:
    """Return skill directory names present on disk."""
    skills_dir = settings.ARGOHARNESS_SKILLS_DIR
    if not skills_dir:
        return []
    base = Path(skills_dir)
    return sorted(
        d.name for d in base.iterdir()
        if d.is_dir() and (d / "SKILL.md").exists()
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _strip_frontmatter(text: str) -> str:
    """Remove YAML frontmatter block (--- ... ---) if present."""
    stripped = text.strip()
    if not stripped.startswith("---"):
        return stripped
    lines = stripped.splitlines()
    # Find closing ---
    for i, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            return "\n".join(lines[i + 1:]).strip()
    return stripped  # no closing --- found — return as-is
