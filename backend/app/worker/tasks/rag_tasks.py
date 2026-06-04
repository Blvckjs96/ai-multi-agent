"""Celery tasks for RAG auto-fetch.

Runs every 20 minutes (matching OpenHuman's sync cadence) to keep the
knowledge base up-to-date with minimal manual intervention.
"""

import asyncio
import logging

from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.worker.tasks.rag_tasks.sync_rag_sources",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def sync_rag_sources(self) -> dict:  # type: ignore[type-arg]
    """Fetch all active sync sources and update the RAG knowledge base."""

    async def _run() -> dict[str, int]:
        from app.db.session import async_session_maker
        from app.services.rag_sync import sync_all

        async with async_session_maker() as db:
            return await sync_all(db)

    try:
        results = asyncio.run(_run())
        total = sum(results.values())
        logger.info("RAG sync complete — %d chunks across %d sources", total, len(results))
        return {"status": "ok", "sources": results, "total_chunks": total}
    except Exception as exc:
        logger.error("RAG sync task failed: %s", exc)
        raise self.retry(exc=exc) from exc
