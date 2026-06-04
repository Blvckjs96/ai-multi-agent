"""arq background tasks for the Chiron MRP pipeline."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def ingest_mrp_task(ctx: dict, source_id: str, workspace_id: str) -> dict:
    """Run TRIAGE→MAP→REDUCE→REFINE→VERIFY for a single source.

    Enqueued by ChironService.ingest_source() after the source row is saved.
    """
    from app.chiron.ai.mrp.pipeline import run_mrp_pipeline

    logger.info("arq: ingest_mrp_task started source=%s workspace=%s", source_id, workspace_id)
    try:
        plan_id = await run_mrp_pipeline(source_id, workspace_id)
        logger.info("arq: ingest_mrp_task done source=%s plan=%s", source_id, plan_id)
        return {"status": "ok", "plan_id": plan_id, "source_id": source_id}
    except Exception as exc:
        logger.exception("arq: ingest_mrp_task failed source=%s", source_id)
        return {"status": "error", "source_id": source_id, "error": str(exc)}


async def commit_plan_task(
    ctx: dict, plan_id: str, workspace_id: str, changed_by: str | None = None
) -> dict:
    """COMMIT phase — apply approved proposed_pages to ChironWikiPage records.

    After committing, enqueues embed_page_task for each new/updated page.
    """
    from arq import create_pool
    from arq.connections import RedisSettings

    from app.chiron.ai.mrp.pipeline import commit_plan
    from app.core.config import settings

    logger.info("arq: commit_plan_task started plan=%s workspace=%s", plan_id, workspace_id)
    try:
        page_ids = await commit_plan(plan_id, workspace_id, changed_by=changed_by)
        logger.info("arq: commit_plan_task done plan=%s pages=%d", plan_id, len(page_ids))
    except Exception as exc:
        logger.exception("arq: commit_plan_task failed plan=%s", plan_id)
        return {"status": "error", "plan_id": plan_id, "error": str(exc)}

    # Enqueue embedding jobs for all committed pages
    if page_ids and settings.OPENAI_API_KEY:
        try:
            redis = await create_pool(
                RedisSettings(
                    host=settings.REDIS_HOST,
                    port=settings.REDIS_PORT,
                    password=settings.REDIS_PASSWORD,
                    database=settings.REDIS_DB,
                ),
                default_queue_name="chiron",
            )
            for page_id in page_ids:
                await redis.enqueue_job("embed_page_task", page_id)
            await redis.aclose()
            logger.info("arq: enqueued %d embed_page_task jobs", len(page_ids))
        except Exception:
            logger.exception("arq: failed to enqueue embedding tasks for plan=%s", plan_id)

    return {"status": "ok", "plan_id": plan_id, "page_ids": page_ids}
