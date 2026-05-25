"""SkillLibrary — per-agent UI/UX and domain skill selector.

Replaces the OMNI Docker HTTP adapter with direct file reads from
backend/app/agents/skills/<agent_type>/. Skills are version-controlled
markdown files that map to specific patterns and code examples.

Agent types and their skill directories:
  - engineer_ui  → skills/ui/       (30 UI/UX patterns for the Engineer)
  - engineer_backend → skills/backend/ (API, DB, deploy, security patterns)
  - planner      → skills/planner/  (project planning, TDD, API design)
  - cost_estimator → skills/cost/   (LLM cost estimation heuristics)
  - writer       → skills/writer/   (technical writing — always injected)

Selection strategy:
  1. Keyword-based tag matching against the task description.
  2. At most _MAX_SKILLS_MAP[agent_type] files are merged per agent.
  3. engineer_ui: always appends frontend-design as quality baseline.
  4. writer: always injects all writing skills (no keyword filter).
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

_BASE = Path(__file__).parent

# Per-agent skill directories.
_SKILLS_DIRS: dict[str, Path] = {
    "engineer_ui": _BASE / "skills" / "ui",
    "engineer_backend": _BASE / "skills" / "backend",
    "planner": _BASE / "skills" / "planner",
    "cost_estimator": _BASE / "skills" / "cost",
    "writer": _BASE / "skills" / "writer",
}

# Maximum skill files to merge per agent type.
_MAX_SKILLS_MAP: dict[str, int] = {
    "engineer_ui": 3,
    "engineer_backend": 2,
    "planner": 2,
    "cost_estimator": 2,
    "writer": 99,  # writer always injects all available writing skills
}

# Backward-compat alias (engineer_ui default).
MAX_SKILLS = _MAX_SKILLS_MAP["engineer_ui"]

# Whole-word tokeniser — splits on non-alphanumeric, keeps hyphens inside words.
_TOKEN_RE = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")

# ── Per-agent keyword → skill filename rules ────────────────────────────────
# Each entry: (frozenset_of_keywords, skill_filename_without_extension).
# Keywords are matched as whole tokens against the lowercased description.
# Order: most specific first, general baseline last.

_ENGINEER_UI_RULES: list[tuple[frozenset[str], str]] = [
    # Visual style directions
    (frozenset({"glassmorphism", "glass", "blur", "frost", "frosted", "backdrop"}), "glassmorphism-ui"),
    (frozenset({"neo-brutalism", "brutalism", "brutalist", "neobrutalism"}), "neo-brutalism"),
    (frozenset({"liquid-glass", "ios-glass", "dynamic-glass", "liquid"}), "liquid-glass-design"),
    (frozenset({"dark-mode", "dark-theme", "night-mode", "dark"}), "dark-mode-ui"),
    (frozenset({"light-mode", "light-theme", "white-mode", "light"}), "light-mode-ui"),
    # Layout & composition
    (frozenset({"bento", "mosaic", "grid-layout", "tile", "tiles"}), "bento-grid"),
    (frozenset({"hero", "landing-page", "above-the-fold", "cta"}), "hero-sections"),
    (frozenset({"saas-landing", "marketing-page", "saas", "marketing"}), "landing-page"),
    (frozenset({"dashboard", "admin", "analytics", "kpi", "metrics", "stats", "panel"}), "dashboard-layout"),
    (frozenset({"slides", "presentation", "slideshow"}), "frontend-slides"),
    # Navigation & menus
    (frozenset({"navbar", "navigation", "nav", "menu", "sidebar", "breadcrumb", "tabs", "drawer", "mobile-nav"}), "navigation-patterns"),
    # UI components
    (frozenset({"dialog", "sheet", "alert-dialog", "popover", "tooltip", "overlay"}), "modal-drawer"),
    (frozenset({"toast", "notification", "alert", "banner", "badge-count"}), "notification-system"),
    (frozenset({"gallery", "lightbox", "masonry", "image-grid"}), "image-gallery"),
    (frozenset({"pricing", "price-table", "plans", "subscription-ui"}), "pricing-table"),
    (frozenset({"table", "datatable", "data-table", "sortable", "filterable", "pagination"}), "data-table"),
    # Auth & forms
    (frozenset({"login", "signup", "register", "auth-form", "authentication-form"}), "auth-form"),
    # Data & charts
    (frozenset({"chart", "graph", "visualization", "svg-chart", "donut", "bar-chart"}), "data-visualization"),
    # Animation & motion
    (frozenset({"scrollytelling", "scroll-driven", "parallax", "pinned", "sticky-scroll"}), "scrollytelling"),
    (frozenset({"gsap", "scrolltrigger", "timeline-animation", "tween"}), "gsap-animations"),
    (frozenset({"animation", "animate", "motion", "framer", "spring", "transition"}), "framer-motion"),
    (frozenset({"micro-interaction", "hover-effect", "skeleton", "optimistic-ui"}), "micro-interactions"),
    # 3D & WebGL
    (frozenset({"three-js", "threejs", "3d", "webgl", "r3f", "react-three-fiber"}), "three-js-3d"),
    # Design systems & typography
    (frozenset({"typography", "type-scale", "line-height", "type-system"}), "typography-system"),
    (frozenset({"font", "typography-font", "typeface", "font-pair"}), "font-pairing"),
    (frozenset({"color", "palette", "oklch", "tokens", "theme", "colors"}), "color-palette"),
    (frozenset({"style-system", "design-system", "visual-system", "brand-system", "brand"}), "visual-style-system"),
    # E-commerce
    (frozenset({"ecommerce", "e-commerce", "product-card", "cart", "checkout", "shop"}), "e-commerce-ui"),
    # Framework patterns
    (frozenset({"react-hooks", "state-management", "zustand", "nextjs", "performance"}), "frontend-patterns"),
    # General frontend baseline (lowest priority — catches remaining UI tasks)
    (frozenset({"frontend", "ui", "ux", "component", "interface", "web", "screen", "page", "layout",
                "button", "form", "modal", "popup", "card", "responsive", "mobile", "design", "style",
                "css", "tailwind", "react", "vue", "svelte", "widget", "app"}), "frontend-design"),
]

_ENGINEER_BACKEND_RULES: list[tuple[frozenset[str], str]] = [
    (frozenset({"api", "endpoint", "rest", "graphql", "openapi", "swagger"}), "api-design"),
    (frozenset({"backend", "service", "server", "microservice", "event-driven", "cqrs", "domain"}), "backend-patterns"),
    (frozenset({"database", "migration", "schema", "alembic", "flyway", "migrate"}), "database-migrations"),
    (frozenset({"deploy", "deployment", "ci-cd", "cicd", "blue-green", "canary", "rollout", "release"}), "deployment-patterns"),
    (frozenset({"docker", "container", "compose", "kubernetes", "k8s", "orchestration", "dockerfile"}), "docker-patterns"),
    (frozenset({"postgres", "postgresql", "sql", "index", "query", "partition", "vacuum"}), "postgres-patterns"),
    (frozenset({"security", "auth", "owasp", "threat", "vulnerability", "pentest", "injection", "xss"}), "security-review"),
    (frozenset({"python", "fastapi", "async", "pydantic", "asyncio", "uvicorn", "celery"}), "python-patterns"),
]

_PLANNER_RULES: list[tuple[frozenset[str], str]] = [
    (frozenset({"blueprint", "plan", "roadmap", "sprint", "milestone", "phase", "scope", "kickoff"}), "blueprint"),
    (frozenset({"test", "tdd", "testing", "quality", "coverage", "qa", "spec"}), "tdd-workflow"),
    (frozenset({"api", "endpoint", "rest", "graphql", "integration", "contract"}), "api-design"),
]

_COST_ESTIMATOR_RULES: list[tuple[frozenset[str], str]] = [
    (frozenset({"llm", "ai", "tokens", "anthropic", "openai", "gpt", "claude", "gemini", "inference"}), "cost-aware-llm-pipeline"),
    (frozenset({"token", "budget", "context", "api-cost", "rate-limit", "pricing"}), "token-budget-advisor"),
]

# Writer has no keyword rules — all writing skills are always injected.
_WRITER_SKILLS: list[str] = ["article-writing", "product-capability", "coding-standards"]

_AGENT_RULES: dict[str, list[tuple[frozenset[str], str]]] = {
    "engineer_ui": _ENGINEER_UI_RULES,
    "engineer_backend": _ENGINEER_BACKEND_RULES,
    "planner": _PLANNER_RULES,
    "cost_estimator": _COST_ESTIMATOR_RULES,
    "writer": [],  # uses _WRITER_SKILLS instead
}


def _tokenise(text: str) -> set[str]:
    """Lowercase and tokenise the description into a set of whole words."""
    return set(_TOKEN_RE.findall(text.lower()))


def select_skills(description: str, agent_type: str = "engineer_ui") -> list[str]:
    """Return an ordered list of skill filenames (without extension) for this description.

    For 'writer': always returns all writer skills regardless of description.
    For other agents: keyword-matches against the agent's rule set.
    """
    if agent_type == "writer":
        return list(_WRITER_SKILLS)

    rules = _AGENT_RULES.get(agent_type, _ENGINEER_UI_RULES)
    max_sk = _MAX_SKILLS_MAP.get(agent_type, MAX_SKILLS)
    tokens = _tokenise(description)
    selected: list[str] = []
    seen: set[str] = set()

    for keywords, skill_name in rules:
        if len(selected) >= max_sk:
            break
        if keywords & tokens and skill_name not in seen:
            selected.append(skill_name)
            seen.add(skill_name)

    # engineer_ui: append quality baseline only when at least one specific skill matched.
    if agent_type == "engineer_ui" and selected and len(selected) < max_sk and "frontend-design" not in seen:
        selected.append("frontend-design")

    return selected


def load_skill(name: str, agent_type: str = "engineer_ui") -> str | None:
    """Read a skill file by name (without extension). Returns None if missing."""
    skills_dir = _SKILLS_DIRS.get(agent_type)
    if skills_dir is None:
        logger.warning("Unknown agent_type '%s', no skills directory mapped.", agent_type)
        return None
    path = skills_dir / f"{name}.md"
    if not path.exists():
        logger.debug("Skill file not found: %s", path)
        return None
    return path.read_text(encoding="utf-8")


def get_guidance(description: str, agent_type: str = "engineer_ui") -> str | None:
    """Return merged skill guidance for the given task description and agent type.

    Returns None if no skills are selected (non-UI/non-relevant task).
    Returns a merged markdown string of matching skill files otherwise.
    """
    names = select_skills(description, agent_type)
    if not names:
        return None

    parts: list[str] = []
    for name in names:
        content = load_skill(name, agent_type)
        if content:
            parts.append(f"### Skill: {name}\n\n{content.strip()}")
            logger.debug("Skill '%s' (%s) loaded (%d chars)", name, agent_type, len(content))

    if not parts:
        return None

    return "\n\n---\n\n".join(parts)
