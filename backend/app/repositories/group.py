"""Group repository — pure data access, no business logic."""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.group import Group


async def create_group(
    db: AsyncSession,
    *,
    name: str,
    description: str | None = None,
    permissions: dict[str, Any] | None = None,
) -> Group:
    group = Group(name=name, description=description, permissions=permissions or {})
    db.add(group)
    await db.flush()
    await db.refresh(group)
    return group


async def get_group_by_id(db: AsyncSession, group_id: uuid.UUID) -> Group | None:
    result = await db.execute(select(Group).where(Group.id == group_id))
    return result.scalar_one_or_none()


async def get_groups_by_member_id(db: AsyncSession, user_id: str) -> list[Group]:
    """Return all groups that include user_id in their member_ids array."""
    result = await db.execute(
        select(Group).where(Group.member_ids.contains([user_id]))
    )
    return list(result.scalars().all())


async def add_member(db: AsyncSession, group_id: uuid.UUID, user_id: str) -> Group | None:
    group = await get_group_by_id(db, group_id)
    if not group:
        return None
    if user_id not in group.member_ids:
        group.member_ids = [*group.member_ids, user_id]
    await db.flush()
    await db.refresh(group)
    return group


async def remove_member(db: AsyncSession, group_id: uuid.UUID, user_id: str) -> Group | None:
    group = await get_group_by_id(db, group_id)
    if not group:
        return None
    group.member_ids = [uid for uid in group.member_ids if uid != user_id]
    await db.flush()
    await db.refresh(group)
    return group


async def update_permissions(
    db: AsyncSession, group_id: uuid.UUID, permissions: dict[str, Any]
) -> Group | None:
    group = await get_group_by_id(db, group_id)
    if not group:
        return None
    group.permissions = permissions
    await db.flush()
    await db.refresh(group)
    return group


async def delete_group(db: AsyncSession, group_id: uuid.UUID) -> bool:
    group = await get_group_by_id(db, group_id)
    if not group:
        return False
    await db.delete(group)
    await db.flush()
    return True
