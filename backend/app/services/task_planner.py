"""Task Planner for the local AI agent (OllamaCodeSession).

Decomposes a user message into an ordered list of steps that guides the local
model's tool-use strategy.  A rule-based fast path covers ~70 % of real tasks
with zero LLM latency; an async LLM fallback handles open-ended requests.

The planner does NOT change which tools are allowed — that is triage's job.
It only produces a short preamble injected into the user message so the model
knows what strategy to follow before it starts calling tools.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from app.core.config import settings
from app.services.claude_cli import TriageResult

logger = logging.getLogger(__name__)

# Tools that imply file-modification intent.
_WRITE_TOOLS: frozenset[str] = frozenset({"Write", "Edit", "MultiEdit", "Bash"})
# Tools that imply web / knowledge lookup.
_SEARCH_TOOLS: frozenset[str] = frozenset({"WebSearch", "Grep", "Glob", "Read"})


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------


@dataclass
class TaskPlan:
    steps: list[str]
    strategy: str          # "search_first" | "read_first" | "direct" | "respond"
    estimated_tools: list[str] = field(default_factory=list)
    source: str = "rule"   # "rule" | "llm" | "fallback"


# ---------------------------------------------------------------------------
# Rule-based templates
# ---------------------------------------------------------------------------

_WRITE_TOOLS_SET = {"Write", "Edit", "Bash"}

_TEMPLATES: dict[str, TaskPlan] = {
    "debugging": TaskPlan(
        steps=[
            "Search for the error message or symbol name",
            "Read the relevant source files",
            "Diagnose the root cause",
            "Apply a minimal targeted fix",
            "Verify with a test or command",
        ],
        strategy="search_first",
        estimated_tools=["Grep", "Read", "Edit"],
        source="rule",
    ),
    "research": TaskPlan(
        steps=[
            "Search the codebase and knowledge base for relevant context",
            "Read the most relevant files or symbols",
            "Synthesise the findings into a clear explanation",
        ],
        strategy="search_first",
        estimated_tools=["Grep", "Glob", "Read"],
        source="rule",
    ),
    "code_review": TaskPlan(
        steps=[
            "Read the target file(s)",
            "Analyse for correctness, security, and style issues",
            "Report findings with file:line references",
        ],
        strategy="read_first",
        estimated_tools=["Read", "Grep"],
        source="rule",
    ),
    "test_writing": TaskPlan(
        steps=[
            "Read the implementation file to understand the interface",
            "Write a test file following the project's existing test patterns",
            "Run the tests to confirm they pass",
        ],
        strategy="read_first",
        estimated_tools=["Read", "Write", "Bash"],
        source="rule",
    ),
    "frontend_design": TaskPlan(
        steps=[
            "Read existing components in the same area",
            "Plan the component structure and props",
            "Write the component file",
            "Verify it renders correctly",
        ],
        strategy="read_first",
        estimated_tools=["Read", "Write", "Glob"],
        source="rule",
    ),
    "backend_api": TaskPlan(
        steps=[
            "Read existing models and schemas",
            "Plan the route / service / repo changes",
            "Write or edit the relevant files",
            "Verify imports and basic correctness",
        ],
        strategy="read_first",
        estimated_tools=["Read", "Write", "Edit"],
        source="rule",
    ),
    "git_ops": TaskPlan(
        steps=[
            "Run the requested git command",
            "Report the result",
        ],
        strategy="direct",
        estimated_tools=["Bash"],
        source="rule",
    ),
    "file_ops": TaskPlan(
        steps=[
            "Execute the file operation",
            "Verify the result",
        ],
        strategy="direct",
        estimated_tools=["Read", "Write", "Bash"],
        source="rule",
    ),
    "memory_ops": TaskPlan(
        steps=["Respond directly from memory context"],
        strategy="respond",
        estimated_tools=[],
        source="rule",
    ),
    "general_coding": TaskPlan(
        steps=[
            "Read any relevant existing files",
            "Implement the requested code",
            "Verify correctness",
        ],
        strategy="read_first",
        estimated_tools=["Read", "Write", "Edit", "Bash"],
        source="rule",
    ),
    "devops": TaskPlan(
        steps=[
            "Read existing config / Dockerfiles / CI files",
            "Apply the required changes",
            "Verify with a test command",
        ],
        strategy="read_first",
        estimated_tools=["Read", "Write", "Bash"],
        source="rule",
    ),
    "chiron_query": TaskPlan(
        steps=[
            "Search the knowledge base for relevant pages",
            "Synthesise the answer from retrieved context",
        ],
        strategy="search_first",
        estimated_tools=["Read"],
        source="rule",
    ),
}

# Default when nothing matches.
_DEFAULT_PLAN = TaskPlan(
    steps=[
        "Search the codebase for relevant context",
        "Read the most relevant files",
        "Complete the task",
    ],
    strategy="search_first",
    estimated_tools=["Grep", "Read"],
    source="fallback",
)


# ---------------------------------------------------------------------------
# Category inference from TriageResult
# ---------------------------------------------------------------------------


def _infer_category(triage: TriageResult) -> str | None:
    """Map triage metadata to a template key without touching the message."""
    tools = set(triage.allowed_tools)

    # MCP-specific paths
    if any("argomemory" in t for t in tools):
        return "memory_ops"
    if any("chiron" in t for t in tools):
        return "chiron_query"

    # Git: only Bash + Read, haiku, low effort
    if tools <= {"Bash", "Read"} and triage.model == "haiku" and triage.effort == "low":
        return "git_ops"

    # Research / explain: read-only tools, haiku
    if not tools & _WRITE_TOOLS_SET and triage.model == "haiku":
        return "research"

    # High-effort sonnet with write tools
    if triage.effort == "high" and tools & _WRITE_TOOLS_SET:
        # Could be debugging or code review — check if Bash is included
        if "Bash" in tools and "Edit" in tools:
            return "debugging"
        if "Bash" not in tools:
            return "code_review"

    # Test writing: Bash + Write/Edit + sonnet
    if "Bash" in tools and ("Write" in tools or "Edit" in tools) and triage.model == "sonnet":
        if triage.effort == "normal":
            return "test_writing"

    # Backend/frontend: Write + Edit, no Bash, sonnet normal
    if {"Write", "Edit"} & tools and "Bash" not in tools and triage.model == "sonnet":
        return "backend_api"

    # General coding fallback
    if tools & _WRITE_TOOLS_SET:
        return "general_coding"

    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def make_plan(message: str, triage: TriageResult) -> TaskPlan:
    """Return a TaskPlan for this message + triage combination.

    Fast path: rule-based match (microseconds).
    Slow path: LLM decomposition via Ollama (only for complex open-ended tasks).
    """
    category = _infer_category(triage)

    if category and category in _TEMPLATES:
        plan = _TEMPLATES[category]
        logger.debug("Planner: rule-based category=%s strategy=%s", category, plan.strategy)
        return plan

    # LLM fallback — only when Ollama is available and message is long enough
    if len(message.split()) >= 6:
        try:
            plan = await _llm_plan(message, triage)
            logger.info("Planner: LLM-generated plan (steps=%d)", len(plan.steps))
            return plan
        except Exception as exc:
            logger.warning("Planner LLM fallback failed: %s — using default", exc)

    logger.debug("Planner: using default fallback plan")
    return _DEFAULT_PLAN


def build_plan_preamble(message: str, plan: TaskPlan) -> str:
    """Build the user message that includes the plan as a preamble."""
    if plan.strategy == "respond":
        return message  # memory_ops — no tool preamble needed

    steps_text = "\n".join(f"  {i+1}. {s}" for i, s in enumerate(plan.steps))
    return (
        f"{message}\n\n"
        f"[Strategy: {plan.strategy}]\n"
        f"Suggested approach:\n{steps_text}\n\n"
        f"Follow this approach step-by-step. Call tools as needed."
    )


# ---------------------------------------------------------------------------
# LLM fallback planner
# ---------------------------------------------------------------------------


async def _llm_plan(message: str, triage: TriageResult) -> TaskPlan:
    """Ask the lightweight Ollama plan model to decompose the task."""
    import openai

    client = openai.AsyncOpenAI(
        base_url=f"{settings.OLLAMA_HOST.rstrip('/')}/v1",
        api_key="ollama",
    )
    model_id = settings.OLLAMA_PLAN_MODEL

    prompt = (
        f"You are a planning assistant for a coding agent.\n"
        f"The user asked: {message[:500]}\n\n"
        f"List 3-5 concise steps the agent should follow to complete this task.\n"
        f"Reply ONLY with a numbered list, nothing else."
    )

    resp = await client.chat.completions.create(
        model=model_id,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=256,
        temperature=0.1,
    )
    raw = (resp.choices[0].message.content or "").strip()

    # Parse numbered list "1. step\n2. step"
    steps: list[str] = []
    for line in raw.splitlines():
        line = line.strip()
        if line and line[0].isdigit() and ". " in line:
            steps.append(line.split(". ", 1)[1])
    if not steps:
        steps = [raw] if raw else ["Complete the task"]

    return TaskPlan(
        steps=steps,
        strategy="search_first",
        estimated_tools=list(set(triage.allowed_tools)),
        source="llm",
    )
