"""Note repository — pure data access."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.note import Note


async def get_all(
    db: AsyncSession, *, user_id: str, workspace_id: str | None = None
) -> list[Note]:
    stmt = (
        select(Note)
        .where(Note.user_id == user_id)
        .order_by(Note.pinned.desc(), Note.created_at.desc())
    )
    if workspace_id:
        stmt = stmt.where(Note.workspace_id == workspace_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_by_id(
    db: AsyncSession, *, note_id: uuid.UUID, user_id: str
) -> Note | None:
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def create(
    db: AsyncSession,
    *,
    user_id: str,
    workspace_id: str | None = None,
    title: str = "Untitled",
    content: str = "",
) -> Note:
    note = Note(
        user_id=user_id,
        workspace_id=workspace_id,
        title=title,
        content=content,
    )
    db.add(note)
    await db.flush()
    await db.refresh(note)
    return note


async def update(
    db: AsyncSession,
    *,
    note: Note,
    title: str | None = None,
    content: str | None = None,
    pinned: bool | None = None,
) -> Note:
    if title is not None:
        note.title = title
    if content is not None:
        note.content = content
    if pinned is not None:
        note.pinned = pinned
    await db.flush()
    await db.refresh(note)
    return note


async def delete(db: AsyncSession, *, note: Note) -> None:
    await db.delete(note)
    await db.flush()
