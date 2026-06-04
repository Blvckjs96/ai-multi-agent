"""WorkspaceSkill repository."""
from __future__ import annotations
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.workspace_skill import WorkspaceSkill


async def get_all(db: AsyncSession, *, user_id: str) -> list[WorkspaceSkill]:
    result = await db.execute(
        select(WorkspaceSkill)
        .where(WorkspaceSkill.user_id == user_id)
        .order_by(WorkspaceSkill.created_at.desc())
    )
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, *, skill_id: uuid.UUID, user_id: str) -> WorkspaceSkill | None:
    result = await db.execute(
        select(WorkspaceSkill).where(WorkspaceSkill.id == skill_id, WorkspaceSkill.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def create(db: AsyncSession, *, user_id: str, name: str, description: str = "", content: str = "") -> WorkspaceSkill:
    skill = WorkspaceSkill(user_id=user_id, name=name, description=description, content=content)
    db.add(skill)
    await db.flush()
    await db.refresh(skill)
    return skill


async def update(
    db: AsyncSession,
    *,
    skill: WorkspaceSkill,
    name: str | None = None,
    description: str | None = None,
    content: str | None = None,
) -> WorkspaceSkill:
    if name is not None:
        skill.name = name
    if description is not None:
        skill.description = description
    if content is not None:
        skill.content = content
    await db.flush()
    await db.refresh(skill)
    return skill


async def delete(db: AsyncSession, *, skill: WorkspaceSkill) -> None:
    await db.delete(skill)
    await db.flush()
