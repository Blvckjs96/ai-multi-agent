"""Prompt repository."""
from __future__ import annotations
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.prompt import Prompt


async def get_all(db: AsyncSession, *, user_id: str) -> list[Prompt]:
    result = await db.execute(
        select(Prompt)
        .where(Prompt.user_id == user_id)
        .order_by(Prompt.created_at.desc())
    )
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, *, prompt_id: uuid.UUID, user_id: str) -> Prompt | None:
    result = await db.execute(
        select(Prompt).where(Prompt.id == prompt_id, Prompt.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def create(db: AsyncSession, *, user_id: str, name: str, description: str = "", content: str = "") -> Prompt:
    prompt = Prompt(user_id=user_id, name=name, description=description, content=content)
    db.add(prompt)
    await db.flush()
    await db.refresh(prompt)
    return prompt


async def update(
    db: AsyncSession,
    *,
    prompt: Prompt,
    name: str | None = None,
    description: str | None = None,
    content: str | None = None,
) -> Prompt:
    if name is not None:
        prompt.name = name
    if description is not None:
        prompt.description = description
    if content is not None:
        prompt.content = content
    await db.flush()
    await db.refresh(prompt)
    return prompt


async def delete(db: AsyncSession, *, prompt: Prompt) -> None:
    await db.delete(prompt)
    await db.flush()
