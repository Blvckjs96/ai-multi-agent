"""Writer agent — synthesises all prior outputs into a human-readable spec."""

from pydantic_ai import Agent
from pydantic_ai.settings import ModelSettings

from app.agents.pipeline.cost_estimator import CostEstimatorOutput
from app.agents.pipeline.engineer import EngineerOutput
from app.agents.pipeline.model_router import get_model_for_agent
from app.agents.pipeline.planner import PlannerOutput

WRITER_SYSTEM_PROMPT = """You are a senior technical writer who produces clear,
professional software project specifications.

Given structured inputs from a planner, engineer, and cost estimator, you write a
polished Markdown specification document that a client and development team can act on.

Document structure (use these exact section headings):
# Project Specification: [Project Name]

## Executive Summary
2–3 sentences capturing what is being built and why.

## Project Phases
Table or bullet list of phases with goals and timelines.

## Technical Architecture
Clear description of the system, followed by the tech stack as a formatted list.

## Key Technical Decisions
Numbered list with rationale for each decision.

## Cost Estimate
Cost range prominently displayed, then a breakdown table.

## Next Steps
3–5 concrete immediate actions to kick off the project.

Rules:
- Use proper Markdown: headings, tables, bullet lists, bold for emphasis.
- Be specific and actionable. No filler phrases.
- The document should read like it was written by a human expert, not generated.
- Do NOT include a disclaimer that this was AI-generated.
- Include all key information from the inputs — do not omit data.
- Format cost figures with $ and comma separators: $12,500.
"""


async def run_writer(
    description: str,
    plan: PlannerOutput,
    architecture: EngineerOutput,
    cost: CostEstimatorOutput,
) -> str:
    """Run the writer agent and return the formatted Markdown spec.

    Args:
        description: Original project description.
        plan: Structured plan from the planner agent.
        architecture: Technical architecture from the engineer agent.
        cost: Cost estimate from the cost estimator agent.

    Returns:
        Formatted Markdown specification document as a string.
    """
    model, _ = await get_model_for_agent("writer")
    agent = Agent[None, str](
        model=model,
        model_settings=ModelSettings(temperature=0.5),
        system_prompt=WRITER_SYSTEM_PROMPT,
        output_type=str,
    )

    phases_text = "\n".join(
        f"- **{p.name}** ({p.duration}): {p.goal}" for p in plan.phases
    )
    tech_text = "\n".join(f"- {t}" for t in architecture.tech_stack)
    decisions_text = "\n".join(
        f"{i + 1}. {d}" for i, d in enumerate(architecture.key_decisions)
    )
    breakdown_text = "\n".join(
        f"| {item.item} | ${item.cost:,} |" for item in cost.breakdown
    )

    prompt = (
        f"Project description:\n{description}\n\n"
        f"=== PLANNER OUTPUT ===\n"
        f"Phases:\n{phases_text}\n\n"
        f"=== ENGINEER OUTPUT ===\n"
        f"Architecture: {architecture.architecture}\n\n"
        f"Tech stack:\n{tech_text}\n\n"
        f"Key decisions:\n{decisions_text}\n\n"
        f"=== COST ESTIMATOR OUTPUT ===\n"
        f"Range: ${cost.low:,} – ${cost.high:,} {cost.currency}\n\n"
        f"Breakdown:\n| Item | Cost |\n|------|------|\n{breakdown_text}\n\n"
        "Write the complete project specification document."
    )

    result = await agent.run(prompt)
    return result.output
