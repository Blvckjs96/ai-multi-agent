"""Pipeline runner — chains the four agents and yields SSE-compatible events.

Enhancements (inspired by OpenHuman):
  - Token compression: description is compressed before entering the pipeline.
  - RAG context injection: relevant knowledge chunks are prepended to the description.
  - Web search: engineer agent searches DuckDuckGo before designing architecture.
  - Smart model routing: reasoning vs fast model selection per agent.
  - Memory Brain: Tier 2 recall before pipeline starts; lesson saved after complete.
"""

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

from app.agents.pipeline.cost_estimator import run_cost_estimator
from app.agents.pipeline.engineer import run_engineer
from app.agents.pipeline.model_router import AGENT_PROVIDER_MAP
from app.agents.pipeline.planner import run_planner
from app.agents.pipeline.writer import run_writer
from app.agents.tools.token_compression import compress_text, estimate_tokens
from app.core.config import settings
from app.services.memory_svc import memory_svc

logger = logging.getLogger(__name__)


def _sse_event(data: dict[str, Any]) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(data)}\n\n"


async def _get_rag_context(description: str) -> str:
    """Try to retrieve RAG context for the description. Returns '' on any error."""
    try:
        from app.db.session import async_session_maker
        from app.services.rag_document import retrieve_context

        async with async_session_maker() as db:
            return await retrieve_context(db, description, limit=5)
    except Exception as exc:
        logger.debug("RAG retrieval skipped: %s", exc)
        return ""


async def run_pipeline(description: str) -> AsyncGenerator[str, None]:
    """Run the four-agent pipeline and yield SSE-formatted events.

    Events emitted:
      {"type": "pipeline_init", "tokens_before": N, "tokens_after": N, "rag_chunks": N}
      {"type": "agent_start",   "agent": "<name>", "provider": "<provider>"}
      {"type": "agent_done",    "agent": "<name>", "result": <serialisable output>}
      {"type": "complete",      "spec": "<markdown string>"}
      {"type": "error",         "message": "<string>"}

    Args:
        description: User's project description (raw, may be HTML or long).

    Yields:
        SSE-formatted strings (each ending with double newline).
    """
    try:
        # ── 0. Compress + RAG inject + Memory recall ─────────────────────────
        tokens_before = estimate_tokens(description)

        if settings.TOKEN_COMPRESSION_ENABLED:
            compressed = compress_text(description)
        else:
            compressed = description

        rag_context = await _get_rag_context(compressed)
        rag_chunks = rag_context.count("---") if rag_context else 0

        enriched = f"{rag_context}\n\n{compressed}" if rag_context else compressed

        # Tier 2: inject relevant past context from argomemory (budget 400 tokens
        # — smaller than chat's 600 to leave room for the pipeline's own context).
        memory_context = await memory_svc.recall_context(compressed, token_budget=400)
        memory_injected = bool(memory_context)
        if memory_context:
            enriched = f"{memory_context}\n\n{enriched}"

        tokens_after = estimate_tokens(enriched)

        yield _sse_event(
            {
                "type": "pipeline_init",
                "tokens_before": tokens_before,
                "tokens_after": tokens_after,
                "rag_chunks": rag_chunks,
                "memory_injected": memory_injected,
                "compression_enabled": settings.TOKEN_COMPRESSION_ENABLED,
            }
        )
        logger.info(
            "Pipeline init — tokens: %d→%d, rag_chunks: %d, memory: %s",
            tokens_before,
            tokens_after,
            rag_chunks,
            memory_injected,
        )

        # ── 1. Planner ───────────────────────────────────────────────────────
        yield _sse_event(
            {
                "type": "agent_start",
                "agent": "planner",
                "provider": AGENT_PROVIDER_MAP["planner"].value,
            }
        )
        logger.info("Pipeline: running planner")

        plan = await run_planner(enriched)

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

        # ── 2. Engineer (with web search) ────────────────────────────────────
        yield _sse_event(
            {
                "type": "agent_start",
                "agent": "engineer",
                "provider": AGENT_PROVIDER_MAP["engineer"].value,
            }
        )
        logger.info("Pipeline: running engineer (with web search)")

        architecture = await run_engineer(enriched, plan)

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

        # ── 3. Cost Estimator ────────────────────────────────────────────────
        yield _sse_event(
            {
                "type": "agent_start",
                "agent": "cost_estimator",
                "provider": AGENT_PROVIDER_MAP["cost_estimator"].value,
            }
        )
        logger.info("Pipeline: running cost_estimator")

        cost = await run_cost_estimator(enriched, plan, architecture)

        yield _sse_event(
            {
                "type": "agent_done",
                "agent": "cost_estimator",
                "result": {
                    "low": cost.low,
                    "high": cost.high,
                    "currency": cost.currency,
                    "breakdown": [
                        {"item": item.item, "cost": item.cost} for item in cost.breakdown
                    ],
                },
            }
        )

        # ── 4. Writer ────────────────────────────────────────────────────────
        yield _sse_event(
            {
                "type": "agent_start",
                "agent": "writer",
                "provider": AGENT_PROVIDER_MAP["writer"].value,
            }
        )
        logger.info("Pipeline: running writer")

        spec = await run_writer(enriched, plan, architecture, cost)

        yield _sse_event(
            {
                "type": "agent_done",
                "agent": "writer",
                "result": {"preview": spec[:500]},
            }
        )

        # ── Complete ─────────────────────────────────────────────────────────
        yield _sse_event({"type": "complete", "spec": spec})
        logger.info("Pipeline: complete")

        # Tier 2: save pipeline result as a lesson for future sessions.
        await memory_svc.save_insight(
            content=(
                f"Pipeline ran for: {description[:300]}\n"
                f"Spec summary: {spec[:500]}"
            ),
            memory_type="fact",
            concepts=description.split()[:8],
        )

    except Exception as exc:
        logger.exception("Pipeline error: %s", exc)
        yield _sse_event({"type": "error", "message": str(exc)})
