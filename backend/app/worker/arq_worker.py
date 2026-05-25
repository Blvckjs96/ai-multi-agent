"""arq worker for Chiron MRP pipeline tasks.

Run with:
    uv run arq app.worker.arq_worker.WorkerSettings

The Celery worker (celery_app.py) handles RAG sync and other periodic tasks;
this arq worker handles Chiron's async LLM-heavy MRP pipeline jobs.
"""

from __future__ import annotations

import logging

from arq.connections import RedisSettings

from app.core.config import settings
from app.worker.tasks.chiron_tasks import commit_plan_task, ingest_mrp_task
from app.worker.tasks.embedding_tasks import embed_page_task

logger = logging.getLogger(__name__)


async def startup(ctx: dict) -> None:
    logger.info("arq worker: started")


async def shutdown(ctx: dict) -> None:
    logger.info("arq worker: stopped")


class WorkerSettings:
    functions = [ingest_mrp_task, commit_plan_task, embed_page_task]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        password=settings.REDIS_PASSWORD,
        database=settings.REDIS_DB,
    )
    max_jobs = 5
    job_timeout = 3600  # 1 hour — LLM pipeline can be slow on large docs
    keep_result = 86400  # keep job results for 24 hours
    queue_name = "chiron"
