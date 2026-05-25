"""Cost estimator agent — produces a realistic USD budget for the project."""

import asyncio
import logging

from pydantic import BaseModel, Field
from pydantic_ai import Agent
from pydantic_ai.settings import ModelSettings

from app.agents import skill_library
from app.agents.pipeline.engineer import EngineerOutput
from app.agents.pipeline.model_router import get_model_for_agent
from app.agents.pipeline.planner import PlannerOutput

logger = logging.getLogger(__name__)

COST_ESTIMATOR_SYSTEM_PROMPT = """You are a senior freelance project manager who
specialises in budgeting software projects for US-market clients.

Given a project plan and technical architecture, you produce a realistic cost
estimate in USD at current US freelance market rates (2024–2025).

Freelance rate benchmarks (hourly, USD):
- Junior developer: $60–$90
- Mid-level developer: $90–$140
- Senior developer / lead: $140–$200
- UI/UX designer: $80–$130
- DevOps / infrastructure: $100–$160
- QA engineer: $60–$100
- Project management: $80–$120

Rules:
- NEVER underquote. Underquoting burns clients and freelancers alike.
- Assume a small but capable freelance team (1–3 engineers, 1 designer).
- low estimate: fast execution, fewer revisions, simpler implementation.
- high estimate: full quality, proper testing, revisions, buffer for scope creep.
- breakdown: list EVERY meaningful cost bucket. Minimum 3 items, maximum 8.
  Each item has a "item" name and "cost" in USD (midpoint estimate).
- The sum of breakdown costs should fall between low and high.
- currency is always "USD".
- Output ONLY valid JSON that matches the required schema. No prose, no markdown.
"""


class CostBreakdownItem(BaseModel):
    """A single line item in the cost breakdown."""

    item: str = Field(description="Name of the cost bucket, e.g. 'Frontend Development'")
    cost: int = Field(description="Midpoint USD estimate for this item")


class CostEstimatorOutput(BaseModel):
    """Structured output from the cost estimator agent."""

    low: int = Field(description="Conservative low-end total estimate in USD")
    high: int = Field(description="Full-scope high-end total estimate in USD")
    currency: str = Field(default="USD", description="Currency code — always USD")
    breakdown: list[CostBreakdownItem] = Field(
        description="Line-item cost breakdown, 3 to 8 items",
        min_length=3,
        max_length=8,
    )


async def run_cost_estimator(
    description: str,
    plan: PlannerOutput,
    architecture: EngineerOutput,
) -> CostEstimatorOutput:
    """Run the cost estimator agent and return structured output.

    Args:
        description: Original project description.
        plan: Structured plan from the planner agent.
        architecture: Technical architecture from the engineer agent.

    Returns:
        CostEstimatorOutput with low/high range and itemised breakdown.
    """
    model, _ = await get_model_for_agent("cost_estimator")

    guidance = await asyncio.get_event_loop().run_in_executor(
        None, skill_library.get_guidance, description, "cost_estimator"
    )

    system_prompt = COST_ESTIMATOR_SYSTEM_PROMPT
    if guidance:
        selected = skill_library.select_skills(description, "cost_estimator")
        system_prompt = (
            f"{COST_ESTIMATOR_SYSTEM_PROMPT}\n\n"
            "## Cost Estimation Skill Guidance\n"
            f"Skills selected for this task: {', '.join(selected)}.\n"
            "Apply the heuristics below when estimating LLM API and infrastructure costs.\n\n"
            f"{guidance}"
        )
        logger.debug("Cost estimator skills injected: %s (%d chars)", selected, len(guidance))

    agent = Agent[None, CostEstimatorOutput](
        model=model,
        model_settings=ModelSettings(temperature=0.2),
        system_prompt=system_prompt,
        output_type=CostEstimatorOutput,
    )

    phases_text = "\n".join(f"  - {p.name}: {p.goal} ({p.duration})" for p in plan.phases)
    tech_text = ", ".join(architecture.tech_stack)
    decisions_text = "\n".join(f"  - {d}" for d in architecture.key_decisions)

    prompt = (
        f"Project description:\n{description}\n\n"
        f"Project phases:\n{phases_text}\n\n"
        f"Tech stack: {tech_text}\n\n"
        f"Architecture: {architecture.architecture}\n\n"
        f"Key technical decisions:\n{decisions_text}\n\n"
        "Produce a realistic US freelance market cost estimate for this project."
    )

    result = await agent.run(prompt)
    return result.output
