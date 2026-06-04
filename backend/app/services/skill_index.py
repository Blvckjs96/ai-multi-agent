"""Skill index for Task Triage Layer 2 (semantic matching).

Each SkillEntry describes a Claude Code skill or task category with keywords
used for bag-of-words cosine similarity matching. No external ML libraries
required — cosine similarity over keyword sets is fast enough for real-time
triage and avoids adding heavyweight dependencies.

Skills map 1-to-1 with entries in SKILL_INDEX. The triage service uses this
index to identify which skills to prepend to the Claude CLI invocation and
which tool set to authorize.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class SkillEntry:
    name: str  # Skill identifier (prepended as /name to Claude CLI message)
    description: str  # Human-readable purpose
    keywords: frozenset[str]  # Bag-of-words for similarity matching
    tools: frozenset[str]  # Tools this skill needs
    mcp_servers: frozenset[str]  # MCP server keys required (empty = none)
    model: str = "sonnet"  # Preferred model tier: "sonnet" | "haiku" | "opus"
    effort: str = "normal"  # Effort level: "low" | "normal" | "high"


SKILL_INDEX: list[SkillEntry] = [
    SkillEntry(
        name="frontend_design",
        description="UI/UX design, React components, Tailwind CSS, animations, accessibility",
        keywords=frozenset(
            {
                "ui",
                "ux",
                "design",
                "component",
                "react",
                "tailwind",
                "css",
                "style",
                "button",
                "form",
                "modal",
                "layout",
                "animation",
                "responsive",
                "accessibility",
                "frontend",
                "html",
                "jsx",
                "tsx",
                "figma",
                "theme",
                "color",
                "font",
                "navbar",
                "sidebar",
                "card",
                "table",
                "chart",
                "dashboard",
                "icon",
                "hover",
                "focus",
                "transition",
                "gradient",
                "border",
                "shadow",
            }
        ),
        tools=frozenset({"Read", "Write", "Edit", "Bash", "Grep", "Glob"}),
        mcp_servers=frozenset(),
        model="sonnet",
        effort="normal",
    ),
    SkillEntry(
        name="backend_api",
        description="FastAPI routes, SQLAlchemy models, Pydantic schemas, database migrations",
        keywords=frozenset(
            {
                "api",
                "endpoint",
                "route",
                "fastapi",
                "sqlalchemy",
                "pydantic",
                "schema",
                "model",
                "database",
                "migration",
                "alembic",
                "repository",
                "service",
                "crud",
                "rest",
                "http",
                "request",
                "response",
                "middleware",
                "auth",
                "jwt",
                "token",
                "session",
                "query",
                "join",
                "index",
                "postgres",
                "postgresql",
                "asyncpg",
                "orm",
                "relationship",
                "foreign",
                "key",
            }
        ),
        tools=frozenset({"Read", "Write", "Edit", "Bash", "Grep", "Glob"}),
        mcp_servers=frozenset(),
        model="sonnet",
        effort="normal",
    ),
    SkillEntry(
        name="code_review",
        description="Review code for bugs, security issues, performance, and best practices",
        keywords=frozenset(
            {
                "review",
                "check",
                "audit",
                "inspect",
                "analyze",
                "analyse",
                "quality",
                "bug",
                "issue",
                "problem",
                "vulnerability",
                "security",
                "performance",
                "refactor",
                "improve",
                "optimize",
                "lint",
                "type",
                "error",
                "warning",
                "best",
                "practice",
                "pattern",
                "smell",
                "technical",
                "debt",
            }
        ),
        tools=frozenset({"Read", "Grep", "Glob", "Bash"}),
        mcp_servers=frozenset(),
        model="sonnet",
        effort="high",
    ),
    SkillEntry(
        name="debugging",
        description="Debug errors, trace exceptions, fix failing tests, investigate logs",
        keywords=frozenset(
            {
                "debug",
                "fix",
                "error",
                "exception",
                "traceback",
                "stack",
                "trace",
                "failing",
                "fail",
                "broken",
                "crash",
                "panic",
                "segfault",
                "test",
                "log",
                "output",
                "unexpected",
                "wrong",
                "incorrect",
                "not",
                "working",
                "investigate",
                "diagnose",
                "root",
                "cause",
            }
        ),
        tools=frozenset({"Read", "Write", "Edit", "Bash", "Grep", "Glob"}),
        mcp_servers=frozenset(),
        model="sonnet",
        effort="high",
    ),
    SkillEntry(
        name="research",
        description="Web search, documentation lookup, technology comparison, feasibility study",
        keywords=frozenset(
            {
                "research",
                "search",
                "find",
                "look",
                "lookup",
                "documentation",
                "doc",
                "how",
                "what",
                "why",
                "compare",
                "comparison",
                "versus",
                "vs",
                "difference",
                "best",
                "library",
                "package",
                "framework",
                "tool",
                "option",
                "alternative",
                "feasibility",
                "possible",
                "approach",
                "strategy",
                "explore",
                "investigate",
                "learn",
                "understand",
                "explain",
            }
        ),
        tools=frozenset({"WebSearch", "Read", "Grep", "Glob"}),
        mcp_servers=frozenset(),
        model="haiku",
        effort="normal",
    ),
    SkillEntry(
        name="memory_ops",
        description="Save, recall, or update user preferences, facts, and project context via argomemory",
        keywords=frozenset(
            {
                "remember",
                "recall",
                "memory",
                "forget",
                "save",
                "store",
                "preference",
                "setting",
                "context",
                "fact",
                "note",
                "profile",
                "history",
                "previous",
                "last",
                "time",
                "before",
                "conversation",
                "session",
                "user",
                "argomemory",
                "pattern",
                "insight",
                "lesson",
            }
        ),
        tools=frozenset(
            {
                "mcp__argomemory__memory_recall",
                "mcp__argomemory__memory_save",
                "mcp__argomemory__memory_smart_search",
                "mcp__argomemory__memory_sessions",
            }
        ),
        mcp_servers=frozenset({"argomemory"}),
        model="haiku",
        effort="low",
    ),
    SkillEntry(
        name="chiron_query",
        description="Search Chiron knowledge base, retrieve wiki pages, answer from workspace docs",
        keywords=frozenset(
            {
                "chiron",
                "knowledge",
                "wiki",
                "document",
                "doc",
                "know",
                "information",
                "workspace",
                "context",
                "retrieve",
                "search",
                "find",
                "page",
                "note",
                "source",
                "reference",
                "relevant",
                "related",
                "similar",
            }
        ),
        tools=frozenset(
            {
                "mcp__chiron__read_wiki_index",
                "mcp__chiron__list_wiki_pages",
                "mcp__chiron__read_wiki_page",
                "mcp__chiron__search_wiki",
                "mcp__chiron__list_sources",
                "mcp__chiron__get_source",
                "mcp__chiron__get_source_outline",
                "mcp__chiron__get_source_pages",
                "mcp__chiron__list_knowledge_types",
                "Read",
            }
        ),
        mcp_servers=frozenset({"chiron"}),
        model="haiku",
        effort="low",
    ),
    SkillEntry(
        name="chiron_ingest",
        description="Ingest, index, or update a document into Chiron knowledge base",
        keywords=frozenset(
            {
                "ingest",
                "index",
                "upload",
                "add",
                "import",
                "sync",
                "update",
                "chiron",
                "knowledge",
                "wiki",
                "document",
                "embed",
                "vector",
                "semantic",
            }
        ),
        tools=frozenset(
            {
                "Read",
                "Write",
                "Bash",
                "mcp__chiron__edit_wiki_page",
                "mcp__chiron__propose_wiki_edit",
                "mcp__chiron__list_pending_drafts",
                "mcp__chiron__approve_draft",
                "mcp__chiron__reject_draft",
                "mcp__chiron__list_knowledge_types",
            }
        ),
        mcp_servers=frozenset({"chiron"}),
        model="sonnet",
        effort="high",
    ),
    SkillEntry(
        name="file_ops",
        description="Read, write, move, or delete files; directory operations; file search",
        keywords=frozenset(
            {
                "file",
                "files",
                "read",
                "write",
                "create",
                "delete",
                "remove",
                "move",
                "rename",
                "copy",
                "directory",
                "folder",
                "path",
                "search",
                "find",
                "list",
                "ls",
                "cat",
                "content",
                "open",
            }
        ),
        tools=frozenset({"Read", "Write", "Edit", "Bash", "Grep", "Glob"}),
        mcp_servers=frozenset(),
        model="haiku",
        effort="low",
    ),
    SkillEntry(
        name="git_ops",
        description="Git operations: commit, branch, diff, log, merge, rebase, status",
        keywords=frozenset(
            {
                "git",
                "commit",
                "branch",
                "diff",
                "log",
                "merge",
                "rebase",
                "status",
                "push",
                "pull",
                "fetch",
                "checkout",
                "stash",
                "tag",
                "history",
                "change",
                "version",
                "control",
                "repository",
                "repo",
            }
        ),
        tools=frozenset({"Bash", "Read"}),
        mcp_servers=frozenset(),
        model="haiku",
        effort="low",
    ),
    SkillEntry(
        name="test_writing",
        description="Write unit tests, integration tests, E2E tests, pytest fixtures",
        keywords=frozenset(
            {
                "test",
                "tests",
                "testing",
                "unit",
                "integration",
                "e2e",
                "pytest",
                "fixture",
                "mock",
                "assert",
                "coverage",
                "tdd",
                "spec",
                "scenario",
                "case",
                "suite",
                "vitest",
                "playwright",
            }
        ),
        tools=frozenset({"Read", "Write", "Edit", "Bash", "Grep", "Glob"}),
        mcp_servers=frozenset(),
        model="sonnet",
        effort="normal",
    ),
    SkillEntry(
        name="devops",
        description="Docker, CI/CD, deployment, environment setup, infrastructure config",
        keywords=frozenset(
            {
                "docker",
                "compose",
                "dockerfile",
                "container",
                "deploy",
                "deployment",
                "ci",
                "cd",
                "pipeline",
                "github",
                "action",
                "workflow",
                "environment",
                "env",
                "config",
                "infrastructure",
                "nginx",
                "proxy",
                "ssl",
                "certificate",
                "kubernetes",
                "k8s",
                "helm",
                "terraform",
            }
        ),
        tools=frozenset({"Read", "Write", "Edit", "Bash", "Grep", "Glob"}),
        mcp_servers=frozenset(),
        model="sonnet",
        effort="normal",
    ),
    SkillEntry(
        name="general_coding",
        description="General programming tasks, algorithms, data structures, utilities",
        keywords=frozenset(
            {
                "code",
                "implement",
                "write",
                "build",
                "create",
                "function",
                "class",
                "method",
                "algorithm",
                "data",
                "structure",
                "utility",
                "helper",
                "script",
                "program",
                "logic",
                "calculate",
                "convert",
                "parse",
                "format",
                "transform",
                "generate",
            }
        ),
        tools=frozenset({"Read", "Write", "Edit", "Bash", "Grep", "Glob"}),
        mcp_servers=frozenset(),
        model="sonnet",
        effort="normal",
    ),
]

# Name → entry lookup for O(1) access
SKILL_BY_NAME: dict[str, SkillEntry] = {s.name: s for s in SKILL_INDEX}

# Default tools when no skill matches
DEFAULT_TOOLS: frozenset[str] = frozenset(
    {
        "Read",
        "Write",
        "Edit",
        "Bash",
        "Grep",
        "Glob",
    }
)


# ---------------------------------------------------------------------------
# Similarity helpers
# ---------------------------------------------------------------------------


def _tokenize(text: str) -> list[str]:
    """Lowercase, split on non-alphanumeric, drop short tokens."""
    import re

    tokens = re.split(r"[^a-z0-9]+", text.lower())
    return [t for t in tokens if len(t) > 1]


def _cosine_similarity(query_tokens: list[str], keywords: frozenset[str]) -> float:
    """Bag-of-words cosine similarity between query tokens and a keyword set."""
    if not query_tokens or not keywords:
        return 0.0
    matches = sum(1 for t in query_tokens if t in keywords)
    if matches == 0:
        return 0.0
    # |query| uses token frequency; |keywords| is the set size
    query_norm = math.sqrt(len(query_tokens))
    kw_norm = math.sqrt(len(keywords))
    return matches / (query_norm * kw_norm)


def find_matching_skills(message: str, top_k: int = 3, threshold: float = 0.05) -> list[SkillEntry]:
    """Return up to `top_k` skills whose keyword sets best match the message.

    Skills with similarity below `threshold` are excluded. Returns an empty
    list if nothing matches well enough.
    """
    tokens = _tokenize(message)
    if not tokens:
        return []

    scored: list[tuple[float, SkillEntry]] = []
    for skill in SKILL_INDEX:
        score = _cosine_similarity(tokens, skill.keywords)
        if score >= threshold:
            scored.append((score, skill))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [skill for _, skill in scored[:top_k]]
