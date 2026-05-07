"""Planner agent — breaks a project description into concrete phases."""

from pydantic import BaseModel, Field
from pydantic_ai import Agent
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.settings import ModelSettings

PIPELINE_MODEL = "claude-haiku-4-5"

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


def get_planner_agent() -> Agent[None, PlannerOutput]:
    """Create and return the planner agent."""
    model = AnthropicModel(PIPELINE_MODEL)

    return Agent[None, PlannerOutput](
        model=model,
        model_settings=ModelSettings(temperature=0.3),
        system_prompt=PLANNER_SYSTEM_PROMPT,
        output_type=PlannerOutput,
    )


async def run_planner(description: str) -> PlannerOutput:
    """Run the planner agent and return structured output.

    Args:
        description: User's project description.

    Returns:
        PlannerOutput with ordered phases.
    """
    agent = get_planner_agent()
    result = await agent.run(
        f"Create a project plan for the following project:\n\n{description}"
    )
    return result.output
