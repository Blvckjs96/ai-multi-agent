"""Engineer agent — maps a project plan to a concrete technical architecture."""

from pydantic import BaseModel, Field
from pydantic_ai import Agent
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.settings import ModelSettings

from app.agents.pipeline.planner import PIPELINE_MODEL, PlannerOutput

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
- architecture: 1–3 concise sentences describing the overall system shape,
  deployment topology, and data flow. No marketing language.
- keyDecisions: 3–5 specific, justified architectural choices that have real
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
        description="3–5 specific architectural decisions with rationale",
        min_length=2,
        max_length=6,
    )

    model_config = {"populate_by_name": True}


def get_engineer_agent() -> Agent[None, EngineerOutput]:
    """Create and return the engineer agent."""
    model = AnthropicModel(PIPELINE_MODEL)

    return Agent[None, EngineerOutput](
        model=model,
        model_settings=ModelSettings(temperature=0.3),
        system_prompt=ENGINEER_SYSTEM_PROMPT,
        output_type=EngineerOutput,
    )


async def run_engineer(description: str, plan: PlannerOutput) -> EngineerOutput:
    """Run the engineer agent and return structured output.

    Args:
        description: Original project description.
        plan: Structured plan from the planner agent.

    Returns:
        EngineerOutput with tech stack, architecture, and key decisions.
    """
    agent = get_engineer_agent()

    phases_text = "\n".join(
        f"  - {p.name}: {p.goal} ({p.duration})" for p in plan.phases
    )

    prompt = (
        f"Project description:\n{description}\n\n"
        f"Project phases:\n{phases_text}\n\n"
        "Design the technical architecture for this project."
    )

    result = await agent.run(prompt)
    return result.output
