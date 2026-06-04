"""Sync source repository — data access for external sync sources."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.sync_source import SyncSource


async def create(
    db: AsyncSession,
    *,
    name: str,
    source_type: str,
    config: dict,
    is_active: bool = True,
) -> SyncSource:
    source = SyncSource(name=name, source_type=source_type, config=config, is_active=is_active)
    db.add(source)
    await db.flush()
    await db.refresh(source)
    return source


async def get_by_id(db: AsyncSession, source_id: uuid.UUID) -> SyncSource | None:
    result = await db.execute(select(SyncSource).where(SyncSource.id == source_id))
    return result.scalar_one_or_none()


async def list_all(db: AsyncSession) -> list[SyncSource]:
    result = await db.execute(select(SyncSource).order_by(SyncSource.created_at))
    return list(result.scalars().all())


async def list_active(db: AsyncSession) -> list[SyncSource]:
    result = await db.execute(
        select(SyncSource)
        .where(SyncSource.is_active == True)  # noqa: E712
        .order_by(SyncSource.created_at)
    )
    return list(result.scalars().all())


async def update_last_synced(db: AsyncSession, source: SyncSource) -> SyncSource:
    source.last_synced_at = datetime.now(UTC)
    await db.flush()
    await db.refresh(source)
    return source


async def delete(db: AsyncSession, source_id: uuid.UUID) -> SyncSource | None:
    source = await get_by_id(db, source_id)
    if source:
        await db.delete(source)
        await db.flush()
    return source
