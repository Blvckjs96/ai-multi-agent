"""Scheduled memory maintenance tasks for argomemory Tier 2."""

from __future__ import annotations

import asyncio
import logging

from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.worker.tasks.memory_tasks.consolidate_memory", bind=True)
def consolidate_memory(self) -> dict:  # type: ignore[type-arg]
    """Merge duplicate memories and prune low-value entries nightly.

    Calls memory_consolidate on the argomemory REST API.
    Designed to run at low-traffic hours (e.g. 3am via Celery Beat).
    """
    try:
        return asyncio.run(_consolidate())
    except Exception as exc:
        logger.warning("Memory consolidation failed: %s", exc)
        return {"status": "error", "message": str(exc)}


async def _consolidate() -> dict:
    from app.services.memory_svc import memory_svc

    healthy = await memory_svc.is_healthy()
    if not healthy:
        logger.info("Memory consolidation skipped — argomemory unreachable")
        return {"status": "skipped", "reason": "argomemory unreachable"}

    await memory_svc.consolidate()
    logger.info("Memory consolidation completed")
    return {"status": "ok"}
