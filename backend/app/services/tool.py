"""Tool service."""
from __future__ import annotations
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.tool import Tool
from app.repositories import tool as tool_repo
from app.core.exceptions import NotFoundError


class ToolService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(self, user_id: str) -> list[Tool]:
        return await tool_repo.get_all(self.db, user_id=user_id)

    async def get(self, tool_id: uuid.UUID, user_id: str) -> Tool:
        tool = await tool_repo.get_by_id(self.db, tool_id=tool_id, user_id=user_id)
        if not tool:
            raise NotFoundError(message="Tool not found", details={"tool_id": str(tool_id)})
        return tool

    async def create(self, user_id: str, *, name: str, description: str = "", code: str = "") -> Tool:
        return await tool_repo.create(self.db, user_id=user_id, name=name, description=description, code=code)

    async def update(self, tool_id: uuid.UUID, user_id: str, *, name: str | None = None, description: str | None = None, code: str | None = None) -> Tool:
        tool = await self.get(tool_id, user_id)
        return await tool_repo.update(self.db, tool=tool, name=name, description=description, code=code)

    async def delete(self, tool_id: uuid.UUID, user_id: str) -> None:
        tool = await self.get(tool_id, user_id)
        await tool_repo.delete(self.db, tool=tool)
