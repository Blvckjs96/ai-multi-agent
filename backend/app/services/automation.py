"""AutomationService — CRUD + APScheduler integration."""
from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.models.automation import Automation
from app.repositories import automation as automation_repo

logger = logging.getLogger(__name__)

try:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler

    _scheduler: AsyncIOScheduler | None = AsyncIOScheduler()
except ImportError:
    _scheduler = None
    logger.warning("apscheduler not installed — scheduled automations disabled")


# ---------------------------------------------------------------------------
# Scheduler lifecycle
# ---------------------------------------------------------------------------


async def start_scheduler(db_factory: Any) -> None:
    """Start APScheduler on app startup and load all enabled automations."""
    if _scheduler is None:
        return
    try:
        _scheduler.start()
        async with db_factory() as db:
            automations = await automation_repo.get_enabled_automations(db)
            for auto in automations:
                if auto.schedule_cron:
                    _add_job(auto, db_factory)
        logger.info("AutomationScheduler started — %d job(s) loaded", len(automations))
    except Exception:
        logger.exception("Failed to start AutomationScheduler")


def stop_scheduler() -> None:
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)


def _parse_cron(expr: str) -> dict[str, Any]:
    parts = expr.strip().split()
    if len(parts) == 5:
        return {
            "minute": parts[0],
            "hour": parts[1],
            "day": parts[2],
            "month": parts[3],
            "day_of_week": parts[4],
        }
    return {"hour": 9, "minute": 0}


def _add_job(automation: Automation, db_factory: Any) -> None:
    if _scheduler is None:
        return
    job_id = str(automation.id)
    try:
        _scheduler.add_job(
            _run_automation,
            "cron",
            id=job_id,
            replace_existing=True,
            args=[automation.id, db_factory],
            **_parse_cron(automation.schedule_cron or "0 9 * * *"),
        )
    except Exception:
        logger.exception("Failed to schedule automation %s", job_id)


def _remove_job(automation_id: uuid.UUID) -> None:
    if _scheduler is None:
        return
    job_id = str(automation_id)
    try:
        if _scheduler.get_job(job_id):
            _scheduler.remove_job(job_id)
    except Exception:
        logger.exception("Failed to remove job %s", job_id)


async def _run_automation(automation_id: uuid.UUID, db_factory: Any) -> None:
    """Execute one automation: log run time and store result placeholder."""
    async with db_factory() as db:
        auto = await automation_repo.get_by_id(db, automation_id)
        if not auto or not auto.enabled:
            return
        now_iso = datetime.now(UTC).isoformat()
        await automation_repo.update(
            db,
            db_automation=auto,
            update_data={
                "last_run_at": now_iso,
                "last_result": f"[Ran at {now_iso}] prompt: {auto.prompt[:120]}",
            },
        )
        logger.info("Automation %s executed at %s", automation_id, now_iso)


# ---------------------------------------------------------------------------
# Service class
# ---------------------------------------------------------------------------


class AutomationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(
        self, *, user_id: str, skip: int = 0, limit: int = 100
    ) -> tuple[list[Automation], int]:
        return await automation_repo.get_all_by_user(
            self.db, user_id=user_id, skip=skip, limit=limit
        )

    async def get(self, automation_id: uuid.UUID, *, user_id: str) -> Automation:
        auto = await automation_repo.get_by_id(self.db, automation_id)
        if not auto or auto.user_id != user_id:
            raise NotFoundError(
                message="Automation not found",
                details={"automation_id": str(automation_id)},
            )
        return auto

    async def create(
        self,
        *,
        user_id: str,
        workspace_id: str | None,
        name: str,
        schedule_cron: str | None,
        model_id: str | None,
        prompt: str,
        enabled: bool = True,
        db_factory: Any = None,
    ) -> Automation:
        auto = await automation_repo.create(
            self.db,
            user_id=user_id,
            workspace_id=workspace_id,
            name=name,
            schedule_cron=schedule_cron,
            model_id=model_id,
            prompt=prompt,
            enabled=enabled,
        )
        if enabled and schedule_cron and db_factory:
            _add_job(auto, db_factory)
        return auto

    async def update(
        self,
        automation_id: uuid.UUID,
        *,
        user_id: str,
        update_data: dict[str, Any],
        db_factory: Any = None,
    ) -> Automation:
        auto = await self.get(automation_id, user_id=user_id)
        updated = await automation_repo.update(self.db, db_automation=auto, update_data=update_data)
        # Re-sync scheduler
        _remove_job(automation_id)
        if updated.enabled and updated.schedule_cron and db_factory:
            _add_job(updated, db_factory)
        return updated

    async def delete(self, automation_id: uuid.UUID, *, user_id: str) -> None:
        await self.get(automation_id, user_id=user_id)
        await automation_repo.delete(self.db, automation_id)
        _remove_job(automation_id)

    async def trigger(self, automation_id: uuid.UUID, *, user_id: str) -> Automation:
        """Manually run an automation immediately."""
        auto = await self.get(automation_id, user_id=user_id)
        now_iso = datetime.now(UTC).isoformat()
        return await automation_repo.update(
            self.db,
            db_automation=auto,
            update_data={
                "last_run_at": now_iso,
                "last_result": f"[Manual run at {now_iso}] prompt: {auto.prompt[:120]}",
            },
        )
