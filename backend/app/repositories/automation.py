"""Automation repository — pure data access."""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.automation import Automation


async def get_all_by_user(
    db: AsyncSession,
    *,
    user_id: str,
    skip: int = 0,
    limit: int = 100,
) -> tuple[list[Automation], int]:
    q = select(Automation).where(Automation.user_id == user_id).offset(skip).limit(limit)
    result = await db.execute(q)
    items = list(result.scalars().all())

    count_q = select(Automation).where(Automation.user_id == user_id)
    total = len(list((await db.execute(count_q)).scalars().all()))
    return items, total


async def get_by_id(db: AsyncSession, automation_id: uuid.UUID) -> Automation | None:
    result = await db.execute(select(Automation).where(Automation.id == automation_id))
    return result.scalar_one_or_none()


async def get_enabled_automations(db: AsyncSession) -> list[Automation]:
    result = await db.execute(select(Automation).where(Automation.enabled.is_(True)))
    return list(result.scalars().all())


async def create(
    db: AsyncSession,
    *,
    user_id: str,
    workspace_id: str | None,
    name: str,
    schedule_cron: str | None,
    model_id: str | None,
    prompt: str,
    enabled: bool = True,
) -> Automation:
    automation = Automation(
        user_id=user_id,
        workspace_id=workspace_id,
        name=name,
        schedule_cron=schedule_cron,
        model_id=model_id,
        prompt=prompt,
        enabled=enabled,
    )
    db.add(automation)
    await db.flush()
    await db.refresh(automation)
    return automation


async def update(
    db: AsyncSession,
    *,
    db_automation: Automation,
    update_data: dict[str, Any],
) -> Automation:
    for field, value in update_data.items():
        setattr(db_automation, field, value)
    await db.flush()
    await db.refresh(db_automation)
    return db_automation


async def delete(db: AsyncSession, automation_id: uuid.UUID) -> Automation | None:
    automation = await get_by_id(db, automation_id)
    if automation:
        await db.delete(automation)
        await db.flush()
    return automation
