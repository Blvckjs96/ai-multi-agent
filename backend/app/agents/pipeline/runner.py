"""Pipeline runner — chains the four agents and yields SSE-compatible events."""

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

from app.agents.pipeline.cost_estimator import run_cost_estimator
from app.agents.pipeline.engineer import run_engineer
from app.agents.pipeline.planner import run_planner
from app.agents.pipeline.writer import run_writer

logger = logging.getLogger(__name__)


def _sse_event(data: dict[str, Any]) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(data)}\n\n"


async def run_pipeline(description: str) -> AsyncGenerator[str, None]:
    """Run the four-agent pipeline and yield SSE-formatted events.

    Events emitted:
      {"type": "agent_start",  "agent": "<name>"}
      {"type": "agent_done",   "agent": "<name>", "result": <serialisable output>}
      {"type": "complete",     "spec": "<markdown string>"}
      {"type": "error",        "message": "<string>"}

    Args:
        description: User's project description.

    Yields:
        SSE-formatted strings (each ending with double newline).
    """
    try:
        # ── 1. Planner ──────────────────────────────────────────────────────
        yield _sse_event({"type": "agent_start", "agent": "planner"})
        logger.info("Pipeline: running planner")

        plan = await run_planner(description)

        yield _sse_event(
            {
                "type": "agent_done",
                "agent": "planner",
                "result": {
                    "phases": [
                        {"name": p.name, "goal": p.goal, "duration": p.duration}
                        for p in plan.phases
                    ]
                },
            }
        )

        # ── 2. Engineer ─────────────────────────────────────────────────────
        yield _sse_event({"type": "agent_start", "agent": "engineer"})
        logger.info("Pipeline: running engineer")

        architecture = await run_engineer(description, plan)

        yield _sse_event(
            {
                "type": "agent_done",
                "agent": "engineer",
                "result": {
                    "techStack": architecture.tech_stack,
                    "architecture": architecture.architecture,
                    "keyDecisions": architecture.key_decisions,
                },
            }
        )

        # ── 3. Cost Estimator ───────────────────────────────────────────────
        yield _sse_event({"type": "agent_start", "agent": "cost_estimator"})
        logger.info("Pipeline: running cost_estimator")

        cost = await run_cost_estimator(description, plan, architecture)

        yield _sse_event(
            {
                "type": "agent_done",
                "agent": "cost_estimator",
                "result": {
                    "low": cost.low,
                    "high": cost.high,
                    "currency": cost.currency,
                    "breakdown": [
                        {"item": item.item, "cost": item.cost}
                        for item in cost.breakdown
                    ],
                },
            }
        )

        # ── 4. Writer ───────────────────────────────────────────────────────
        yield _sse_event({"type": "agent_start", "agent": "writer"})
        logger.info("Pipeline: running writer")

        spec = await run_writer(description, plan, architecture, cost)

        yield _sse_event(
            {
                "type": "agent_done",
                "agent": "writer",
                "result": {"preview": spec[:500]},
            }
        )

        # ── Complete ────────────────────────────────────────────────────────
        yield _sse_event({"type": "complete", "spec": spec})
        logger.info("Pipeline: complete")

    except Exception as exc:
        logger.exception("Pipeline error: %s", exc)
        yield _sse_event({"type": "error", "message": str(exc)})
