"""Workspace service."""

from __future__ import annotations

import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AlreadyExistsError, BadRequestError, NotFoundError
from app.db.models.workspace import Workspace


class WorkspaceService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(self) -> list[Workspace]:
        result = await self.db.execute(select(Workspace).order_by(Workspace.name))
        return list(result.scalars().all())

    async def get(self, workspace_id: uuid.UUID) -> Workspace:
        result = await self.db.execute(select(Workspace).where(Workspace.id == workspace_id))
        ws = result.scalar_one_or_none()
        if not ws:
            raise NotFoundError(
                message="Workspace not found", details={"workspace_id": str(workspace_id)}
            )
        return ws

    async def create(self, name: str, path: str, description: str | None = None) -> Workspace:
        resolved = Path(path).resolve()
        if not resolved.is_dir():
            raise BadRequestError(
                message="Workspace path must be an existing directory",
                details={"path": path},
            )
        path = str(resolved)
        existing = await self.db.execute(select(Workspace).where(Workspace.path == path))
        if existing.scalar_one_or_none():
            raise AlreadyExistsError(message="Workspace already exists", details={"path": path})
        ws = Workspace(name=name, path=path, description=description)
        self.db.add(ws)
        await self.db.flush()
        await self.db.refresh(ws)
        return ws

    async def update(self, workspace_id: uuid.UUID, **fields: str) -> Workspace:
        ws = await self.get(workspace_id)
        for k, v in fields.items():
            if v is not None:
                setattr(ws, k, v)
        await self.db.flush()
        await self.db.refresh(ws)
        return ws

    async def delete(self, workspace_id: uuid.UUID) -> None:
        ws = await self.get(workspace_id)
        await self.db.delete(ws)
        await self.db.flush()
