"""Engineer agent — maps a project plan to a concrete technical architecture.

Before generating the architecture, the agent:
  1. Runs a DuckDuckGo web search to ground decisions in current best practices.
  2. Injects UI/UX skill guidance from the local SkillLibrary when the task is
     frontend-related (keyword-based selection from backend/app/agents/skills/ui/).
"""

import logging

from pydantic import BaseModel, Field
from pydantic_ai import Agent
from pydantic_ai.settings import ModelSettings

from app.agents.pipeline.model_router import get_model_for_agent
from app.agents.pipeline.planner import PlannerOutput
from app.agents.tools.web_search import web_search
from app.agents import skill_library

logger = logging.getLogger(__name__)

ENGINEER_SYSTEM_PROMPT = """You are a principal software engineer who specialises in
system design and technical decision-making.

Given a project description and a phased plan, you produce a concrete technical
architecture recommendation.

Rules:
- Choose technologies that are well-matched to the project scope and team size.
- Prefer battle-tested, mainstream choices over bleeding-edge unless there is a
  clear reason (and state it in keyDecisions).
- techStack: list specific technologies/frameworks/services — not categories.
  Good: ["Next.js 14", "FastAPI", "PostgreSQL", "Redis", "AWS S3"]
  Bad: ["frontend framework", "backend", "database"]
- architecture: 1-3 concise sentences describing the overall system shape,
  deployment topology, and data flow. No marketing language.
- keyDecisions: 3-5 specific, justified architectural choices that have real
  trade-off implications. Each should explain what was chosen AND why.
- Output ONLY valid JSON that matches the required schema. No prose, no markdown.
"""


class EngineerOutput(BaseModel):
    """Structured output from the engineer agent."""

    tech_stack: list[str] = Field(
        alias="techStack",
        description="Ordered list of specific technologies, frameworks, and services",
        min_length=3,
        max_length=15,
    )
    architecture: str = Field(
        description="Concise description of the system architecture and data flow"
    )
    key_decisions: list[str] = Field(
        alias="keyDecisions",
        description="3-5 specific architectural decisions with rationale",
        min_length=2,
        max_length=6,
    )

    model_config = {"populate_by_name": True}


async def run_engineer(
    description: str,
    plan: PlannerOutput,
    *,
    search_context: str = "",
) -> EngineerOutput:
    """Run the engineer agent and return structured output.

    Performs a web search first to ground architecture decisions in current
    best practices, then passes those results to the LLM as context.
    For UI/frontend tasks, also injects OMNI skill guidance if available.

    Args:
        description: Original project description.
        plan: Structured plan from the planner agent.
        search_context: Optional pre-fetched web search results to inject.

    Returns:
        EngineerOutput with tech stack, architecture, and key decisions.
    """
    import asyncio

    async def _fetch_search() -> str:
        if search_context:
            return search_context
        query = f"best tech stack architecture for {description[:120]}"
        result = await web_search(query, max_results=4)
        if result:
            logger.debug("Web search returned %d chars for engineer context", len(result))
        return result

    loop = asyncio.get_event_loop()

    # Web search + UI skills + backend skills run concurrently.
    fetched_search, ui_guidance, backend_guidance = await asyncio.gather(
        _fetch_search(),
        loop.run_in_executor(None, skill_library.get_guidance, description, "engineer_ui"),
        loop.run_in_executor(None, skill_library.get_guidance, description, "engineer_backend"),
        return_exceptions=True,
    )
    if isinstance(fetched_search, BaseException):
        fetched_search = ""
    if isinstance(ui_guidance, BaseException):
        ui_guidance = None
    if isinstance(backend_guidance, BaseException):
        backend_guidance = None

    # Build system prompt — append skill guidance blocks when relevant.
    system_prompt = ENGINEER_SYSTEM_PROMPT
    extra_sections: list[str] = []

    if ui_guidance:
        selected_ui = skill_library.select_skills(description, "engineer_ui")
        extra_sections.append(
            "## UI/UX Skill Guidance\n"
            f"Skills selected for this task: {', '.join(selected_ui)}.\n"
            "Follow the code patterns and quality checklists when recommending "
            "frontend technologies and component architecture.\n\n"
            f"{ui_guidance}"
        )
        logger.debug("UI skills injected: %s (%d chars)", selected_ui, len(ui_guidance))

    if backend_guidance:
        selected_be = skill_library.select_skills(description, "engineer_backend")
        extra_sections.append(
            "## Backend/Infrastructure Skill Guidance\n"
            f"Skills selected for this task: {', '.join(selected_be)}.\n"
            "Follow the patterns and conventions below when recommending "
            "backend technologies, APIs, databases, and deployment strategies.\n\n"
            f"{backend_guidance}"
        )
        logger.debug("Backend skills injected: %s (%d chars)", selected_be, len(backend_guidance))

    if extra_sections:
        system_prompt = ENGINEER_SYSTEM_PROMPT + "\n\n" + "\n\n".join(extra_sections)

    model, _ = await get_model_for_agent("engineer")
    agent = Agent[None, EngineerOutput](
        model=model,
        model_settings=ModelSettings(temperature=0.3),
        system_prompt=system_prompt,
        output_type=EngineerOutput,
    )

    phases_text = "\n".join(f"  - {p.name}: {p.goal} ({p.duration})" for p in plan.phases)

    search_section = (
        f"\n\nWeb research context (use as reference only):\n{fetched_search}"
        if fetched_search
        else ""
    )

    prompt = (
        f"Project description:\n{description}\n\n"
        f"Project phases:\n{phases_text}"
        f"{search_section}\n\n"
        "Design the technical architecture for this project."
    )

    result = await agent.run(prompt)
    return result.output
