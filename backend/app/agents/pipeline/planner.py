"""Planner agent — breaks a project description into concrete phases."""

import asyncio
import logging

from pydantic import BaseModel, Field
from pydantic_ai import Agent
from pydantic_ai.settings import ModelSettings

from app.agents import skill_library
from app.agents.pipeline.model_router import get_model_for_agent

logger = logging.getLogger(__name__)

PIPELINE_MODEL = "claude-haiku-4-5"  # kept for legacy imports

PLANNER_SYSTEM_PROMPT = """You are a senior project planner with 15+ years of experience
delivering software products. Given a project description you produce a realistic,
well-scoped project plan.

Rules:
- Produce 3–5 phases maximum. Never pad with unnecessary phases.
- Each phase must have a clear, actionable goal and a realistic duration.
- Phases must flow logically: discovery → design → build → launch → (optionally post-launch).
- Duration strings use human-friendly format: "2 days", "1 week", "2–3 weeks".
- Be conservative, not optimistic — real projects take time.
- Do not include phases that are just "planning" with no deliverable.
- Output ONLY valid JSON that matches the required schema. No prose, no markdown.
"""


class Phase(BaseModel):
    """A single project phase."""

    name: str = Field(description="Short phase name, e.g. Discovery, Design, Engineering")
    goal: str = Field(description="Concrete deliverable or outcome for this phase")
    duration: str = Field(description="Realistic time estimate, e.g. '3 days', '1–2 weeks'")


class PlannerOutput(BaseModel):
    """Structured output from the planner agent."""

    phases: list[Phase] = Field(
        description="Ordered list of project phases, 3 to 5 total",
        min_length=3,
        max_length=5,
    )


async def run_planner(description: str) -> PlannerOutput:
    """Run the planner agent and return structured output.

    Injects planning skill guidance (blueprint, TDD, API design) when relevant
    keywords are detected in the project description.

    Args:
        description: User's project description.

    Returns:
        PlannerOutput with ordered phases.
    """
    model, _ = await get_model_for_agent("planner")

    guidance = await asyncio.get_event_loop().run_in_executor(
        None, skill_library.get_guidance, description, "planner"
    )

    system_prompt = PLANNER_SYSTEM_PROMPT
    if guidance:
        selected = skill_library.select_skills(description, "planner")
        system_prompt = (
            f"{PLANNER_SYSTEM_PROMPT}\n\n"
            "## Planning Skill Guidance\n"
            f"Skills selected for this task: {', '.join(selected)}.\n"
            "Use the methodology and templates below when structuring phases and deliverables.\n\n"
            f"{guidance}"
        )
        logger.debug("Planner skills injected: %s (%d chars)", selected, len(guidance))

    agent = Agent[None, PlannerOutput](
        model=model,
        model_settings=ModelSettings(temperature=0.3),
        system_prompt=system_prompt,
        output_type=PlannerOutput,
    )
    result = await agent.run(f"Create a project plan for the following project:\n\n{description}")
    return result.output
