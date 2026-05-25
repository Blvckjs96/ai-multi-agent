"""Task Triage Service for Argo.

Three-layer classification pipeline that analyses each user message and returns
a TriageResult which shapes the Claude CLI invocation — tool allowlist, MCPs,
skills to prepend, model tier, and effort level.

Layer 1 — Keyword Rules (microseconds, zero I/O)
    Fast exact-match rules for unambiguous task types (file ops, git, memory).
    Short-circuits immediately when confident.

Layer 2 — Skill Semantic Search (milliseconds, no network)
    Bag-of-words cosine similarity against SKILL_INDEX. Merges top matches into
    a combined TriageResult.  Falls through to Layer 3 if score is too low.

Layer 3 — LLM Classifier (hundreds of milliseconds, optional)
    Only triggered when Layers 1+2 are inconclusive. Sends a compact prompt to
    the fast model (haiku) asking it to pick a category from a fixed list. This
    avoids burning expensive tokens on routine triage.

Usage:
    svc = TaskTriageService()
    result = await svc.analyze("write a pytest fixture for user creation")
    # result.allowed_tools == ["Read", "Write", "Edit", "Bash", "Grep", "Glob"]
    # result.skills == ["test_writing"]
    # result.model == "sonnet"
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services.claude_cli import TriageResult
from app.services.skill_index import (
    DEFAULT_TOOLS,
    SKILL_BY_NAME,
    SKILL_INDEX,
    SkillEntry,
    find_matching_skills,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class TriageConfig:
    layer2_threshold: float = 0.07  # Min cosine similarity for Layer 2 match
    layer2_top_k: int = 2  # Max skills to merge from Layer 2
    layer3_min_tokens: int = 6  # Skip Layer 3 for very short messages
    layer3_enabled: bool = True  # Toggle LLM fallback classifier


_config = TriageConfig()


# ---------------------------------------------------------------------------
# Layer 1 — Keyword rules (order matters: first match wins)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class _Rule:
    pattern: re.Pattern[str]
    category: str


_RULES: list[_Rule] = [
    # Memory / recall — short-circuit before anything else
    _Rule(
        re.compile(r"\b(remember|recall|forget|memorize|memory|i told you|you said)\b", re.I),
        "memory_ops",
    ),
    # Chiron knowledge — explicit mentions
    _Rule(re.compile(r"\b(chiron|knowledge base|wiki|ingest|embed)\b", re.I), "chiron_query"),
    # Git operations
    _Rule(
        re.compile(r"\b(git|commit|branch|diff|merge|rebase|stash|checkout|log)\b", re.I), "git_ops"
    ),
    # File operations — only when clearly about files, not code
    _Rule(re.compile(r"\b(rename|move|delete|rm|mkdir|touch|ls |list files)\b", re.I), "file_ops"),
    # Research / lookup
    _Rule(
        re.compile(
            r"\b(search|google|look up|find out|what is|how does|explain|documentation|docs)\b",
            re.I,
        ),
        "research",
    ),
    # Testing
    _Rule(
        re.compile(
            r"\b(write (a |some |the )?test|add (a |some |the )?test|tdd|pytest|vitest|playwright|fixture|mock)\b",
            re.I,
        ),
        "test_writing",
    ),
    # Code review
    _Rule(
        re.compile(
            r"\b(review|audit|check|inspect|find bugs?|security (check|audit|review))\b", re.I
        ),
        "code_review",
    ),
    # Debugging
    _Rule(
        re.compile(
            r"\b(debug|fix (this|the|an?) error|traceback|exception|why (is|does|did)|not working|broken)\b",
            re.I,
        ),
        "debugging",
    ),
    # Frontend
    _Rule(
        re.compile(
            r"\b(component|ui|ux|tailwind|css|react|jsx|tsx|design|style|layout|animation)\b", re.I
        ),
        "frontend_design",
    ),
    # Backend / API
    _Rule(
        re.compile(
            r"\b(endpoint|route|api|fastapi|schema|model|migration|alembic|repository|service|database|sql)\b",
            re.I,
        ),
        "backend_api",
    ),
    # DevOps
    _Rule(
        re.compile(
            r"\b(docker|compose|dockerfile|deploy|ci/cd|github action|nginx|ssl|kubernetes|k8s)\b",
            re.I,
        ),
        "devops",
    ),
]


def _layer1_classify(message: str) -> str | None:
    """Return a category name if a keyword rule fires, else None."""
    for rule in _RULES:
        if rule.pattern.search(message):
            logger.debug("Layer 1 matched category=%s", rule.category)
            return rule.category
    return None


# ---------------------------------------------------------------------------
# Layer 2 — Skill semantic search
# ---------------------------------------------------------------------------


def _layer2_classify(message: str) -> list[SkillEntry]:
    """Return top-k skills from cosine similarity, filtered by threshold."""
    return find_matching_skills(
        message, top_k=_config.layer2_top_k, threshold=_config.layer2_threshold
    )


# ---------------------------------------------------------------------------
# Layer 3 — LLM classifier (haiku, minimal prompt)
# ---------------------------------------------------------------------------


_CATEGORY_LIST = " | ".join(s.name for s in SKILL_INDEX)

_CLASSIFIER_PROMPT = f"""\
You are a task classifier. Given the user message below, reply with EXACTLY ONE \
category name from this list (no other text):

{_CATEGORY_LIST}

User message: {{message}}"""


async def _layer3_classify(message: str) -> str | None:
    """Ask haiku to pick a category. Returns category name or None on failure."""
    if len(message.split()) < _config.layer3_min_tokens:
        return None

    # Use Anthropic API if available; skip gracefully if not
    if not settings.ANTHROPIC_API_KEY:
        logger.debug("Layer 3 skipped — no ANTHROPIC_API_KEY")
        return None

    try:
        import anthropic  # optional heavy import

        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        resp = await client.messages.create(
            model=settings.AI_FAST_MODEL,
            max_tokens=16,
            messages=[
                {"role": "user", "content": _CLASSIFIER_PROMPT.format(message=message[:500])}
            ],
        )
        raw = resp.content[0].text.strip().lower().replace(" ", "_")
        if raw in SKILL_BY_NAME:
            logger.debug("Layer 3 classified as category=%s", raw)
            return raw
        logger.debug("Layer 3 returned unknown category: %s", raw)
    except Exception as exc:
        logger.warning("Layer 3 classifier failed: %s", exc)

    return None


# ---------------------------------------------------------------------------
# TriageResult builder
# ---------------------------------------------------------------------------


def _build_result_from_skill(skill: SkillEntry) -> TriageResult:
    return TriageResult(
        allowed_tools=sorted(skill.tools),
        mcp_servers={k: {} for k in skill.mcp_servers},
        skills=[skill.name],
        model=skill.model,
        effort=skill.effort,
    )


def _merge_results(skills: list[SkillEntry]) -> TriageResult:
    """Merge multiple skill entries into a single TriageResult.

    Tools and MCP servers are unioned. The first skill's model/effort wins
    (since skills are already sorted by similarity score).
    """
    if not skills:
        return _default_result()
    if len(skills) == 1:
        return _build_result_from_skill(skills[0])

    merged_tools: set[str] = set()
    merged_mcps: dict[str, object] = {}
    names: list[str] = []

    for skill in skills:
        merged_tools.update(skill.tools)
        merged_mcps.update({k: {} for k in skill.mcp_servers})
        names.append(skill.name)

    primary = skills[0]
    return TriageResult(
        allowed_tools=sorted(merged_tools),
        mcp_servers=merged_mcps,
        skills=names,
        model=primary.model,
        effort=primary.effort,
    )


def _default_result() -> TriageResult:
    return TriageResult(
        allowed_tools=sorted(DEFAULT_TOOLS),
        mcp_servers={},
        skills=[],
        model="sonnet",
        effort="normal",
    )


def _result_from_category(category: str) -> TriageResult:
    skill = SKILL_BY_NAME.get(category)
    if skill is None:
        return _default_result()
    return _build_result_from_skill(skill)


# ---------------------------------------------------------------------------
# Public service
# ---------------------------------------------------------------------------


class TaskTriageService:
    """Classify a user message and return a TriageResult for Claude CLI."""

    async def analyze(self, message: str) -> TriageResult:
        """Run the three-layer triage pipeline and return a TriageResult.

        Fast path: Layer 1 keyword match → immediate return.
        Medium path: Layer 2 cosine similarity → merge top skills.
        Slow path: Layer 3 LLM classifier → single category result.
        Fallback: Default tools, sonnet model, no skills prepended.
        """
        stripped = message.strip()
        if not stripped:
            return _default_result()

        # --- Layer 1 ---
        category = _layer1_classify(stripped)
        if category:
            result = _result_from_category(category)
            logger.info(
                "Triage L1: category=%s tools=%d skills=%s",
                category,
                len(result.allowed_tools),
                result.skills,
            )
            return result

        # --- Layer 2 ---
        matched_skills = _layer2_classify(stripped)
        if matched_skills:
            result = _merge_results(matched_skills)
            logger.info(
                "Triage L2: skills=%s tools=%d",
                result.skills,
                len(result.allowed_tools),
            )
            return result

        # --- Layer 3 ---
        if _config.layer3_enabled:
            category = await _layer3_classify(stripped)
            if category:
                result = _result_from_category(category)
                logger.info(
                    "Triage L3: category=%s tools=%d",
                    category,
                    len(result.allowed_tools),
                )
                return result

        # --- Fallback ---
        logger.info("Triage: no match, using defaults")
        return _default_result()


# ---------------------------------------------------------------------------
# Workspace context injection (Phase 0.2)
# ---------------------------------------------------------------------------


def _detect_stack(workspace_path: str) -> str:
    """Inspect filesystem to identify the tech stack used in a workspace."""
    root = Path(workspace_path)
    indicators: list[str] = []

    # Python
    py_files = [root / "pyproject.toml", root / "requirements.txt", root / "setup.py"]
    if any(f.exists() for f in py_files):
        label = "Python"
        for f in [root / "pyproject.toml", root / "requirements.txt"]:
            if f.exists():
                try:
                    text = f.read_text(errors="ignore").lower()
                    if "fastapi" in text:
                        label = "Python/FastAPI"
                        break
                    if "django" in text:
                        label = "Python/Django"
                        break
                    if "flask" in text:
                        label = "Python/Flask"
                        break
                except OSError:
                    pass
        indicators.append(label)

    # JavaScript / TypeScript
    pkg_json = root / "package.json"
    if pkg_json.exists():
        label = "TypeScript"
        try:
            pkg = json.loads(pkg_json.read_text(errors="ignore"))
            deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
            if "next" in deps:
                label = "TypeScript/Next.js"
            elif "react" in deps:
                label = "TypeScript/React"
            elif "@tauri-apps/api" in deps:
                label = "TypeScript/React/Tauri"
        except (OSError, json.JSONDecodeError):
            pass
        indicators.append(label)

    # Rust
    if (root / "Cargo.toml").exists():
        indicators.append("Rust")

    # Go
    if (root / "go.mod").exists():
        indicators.append("Go")

    # Database hints from README
    readme = next(
        (root / name for name in ("README.md", "README.rst", "README.txt") if (root / name).exists()),
        None,
    )
    if readme:
        try:
            text = readme.read_text(errors="ignore").lower()
            if "postgresql" in text or "postgres" in text:
                indicators.append("PostgreSQL")
            elif "sqlite" in text:
                indicators.append("SQLite")
            if "redis" in text:
                indicators.append("Redis")
        except OSError:
            pass

    return ", ".join(indicators)


async def build_context_injection(
    query: str,
    workspace_id: UUID,
    workspace_name: str,
    workspace_path: str,
    workspace_description: str | None,
    db: AsyncSession,
) -> str | None:
    """Build system-prompt context from workspace metadata and Chiron wiki pages.

    Returns a formatted block ready for --append-system-prompt, or None when
    there is nothing useful to inject (no stack detected, no wiki pages found).
    """
    sections: list[str] = []

    # ── Workspace header ──────────────────────────────────────────────────────
    stack = _detect_stack(workspace_path)
    ws_lines: list[str] = [
        "--- WORKSPACE CONTEXT ---",
        f"Repo: {workspace_name}",
        f"Path: {workspace_path}",
    ]
    if stack:
        ws_lines.append(f"Stack: {stack}")
    if workspace_description:
        ws_lines.append(f"Description: {workspace_description}")
    sections.append("\n".join(ws_lines))

    # ── Chiron wiki semantic search ───────────────────────────────────────────
    try:
        from app.services.chiron import ChironService

        pages = await ChironService(db).search(workspace_id, query, top_k=5)
        if pages:
            wiki_lines: list[str] = ["--- RELEVANT WIKI PAGES ---"]
            for page in pages[:5]:
                title = page.get("title", "Untitled")
                excerpt = (page.get("summary") or page.get("content", ""))[:500].strip()
                wiki_lines.append(f"[Page: {title}]")
                if excerpt:
                    wiki_lines.append(excerpt)
            sections.append("\n".join(wiki_lines))

    except Exception as exc:
        logger.debug("Chiron wiki injection failed (non-fatal): %s", exc)

    if not stack and len(sections) <= 1:
        return None

    sections.append("--- END CONTEXT ---")
    return "\n\n".join(sections)
