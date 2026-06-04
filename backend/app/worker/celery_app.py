"""Celery application configuration."""

from celery import Celery

from app.core.config import settings

# Create Celery app
celery_app = Celery(
    "ai_multi_agent",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

# Celery configuration
celery_app.conf.update(
    # Task settings
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    # Task execution settings
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    # Result settings
    result_expires=3600,  # 1 hour
    # Worker settings
    worker_prefetch_multiplier=1,
    worker_concurrency=4,
)

# Autodiscover tasks from app.worker.tasks module
celery_app.autodiscover_tasks(["app.worker.tasks"])


celery_app.conf.beat_schedule = {
    "example-every-minute": {
        "task": "app.worker.tasks.examples.example_task",
        "schedule": 60.0,  # Every 60 seconds
        "args": ("periodic",),
    },
    # RAG auto-fetch — every 20 minutes (inspired by OpenHuman's sync cadence)
    "rag-sync-every-20-minutes": {
        "task": "app.worker.tasks.rag_tasks.sync_rag_sources",
        "schedule": 1200.0,  # 20 minutes
    },
    # Memory consolidation — nightly at 3am UTC (21600s from midnight offset is
    # handled by crontab below when using django-celery-beat; for plain beat we
    # run every 24h and accept a floating start time on first deploy).
    "memory-consolidate-daily": {
        "task": "app.worker.tasks.memory_tasks.consolidate_memory",
        "schedule": 86400.0,  # 24 hours
    },
}
