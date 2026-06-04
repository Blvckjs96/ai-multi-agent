"""Tool repository."""
from __future__ import annotations
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.tool import Tool


async def get_all(db: AsyncSession, *, user_id: str) -> list[Tool]:
    result = await db.execute(select(Tool).where(Tool.user_id == user_id).order_by(Tool.created_at.desc()))
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, *, tool_id: uuid.UUID, user_id: str) -> Tool | None:
    result = await db.execute(select(Tool).where(Tool.id == tool_id, Tool.user_id == user_id))
    return result.scalar_one_or_none()


async def create(db: AsyncSession, *, user_id: str, name: str, description: str = "", code: str = "") -> Tool:
    tool = Tool(user_id=user_id, name=name, description=description, code=code)
    db.add(tool)
    await db.flush()
    await db.refresh(tool)
    return tool


async def update(db: AsyncSession, *, tool: Tool, name: str | None = None, description: str | None = None, code: str | None = None) -> Tool:
    if name is not None:
        tool.name = name
    if description is not None:
        tool.description = description
    if code is not None:
        tool.code = code
    await db.flush()
    await db.refresh(tool)
    return tool


async def delete(db: AsyncSession, *, tool: Tool) -> None:
    await db.delete(tool)
    await db.flush()
