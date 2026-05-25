"""TaskSession service — per-issue PTY/CLI session tracking."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.models.task_session import TaskSession


class TaskSessionService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(
        self,
        *,
        task_id: uuid.UUID | None = None,
        workspace_id: uuid.UUID | None = None,
    ) -> list[TaskSession]:
        stmt = select(TaskSession).order_by(TaskSession.created_at.desc())
        if task_id is not None:
            stmt = stmt.where(TaskSession.task_id == task_id)
        if workspace_id is not None:
            stmt = stmt.where(TaskSession.workspace_id == workspace_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get(self, session_id: uuid.UUID) -> TaskSession:
        result = await self.db.execute(select(TaskSession).where(TaskSession.id == session_id))
        session = result.scalar_one_or_none()
        if not session:
            raise NotFoundError(message="TaskSession not found", details={"session_id": str(session_id)})
        return session

    async def create(
        self,
        *,
        task_id: uuid.UUID,
        workspace_id: uuid.UUID,
        shell: str = "zsh",
        cli: str = "claude",
        plan_mode: bool = False,
    ) -> TaskSession:
        session = TaskSession(
            task_id=task_id,
            workspace_id=workspace_id,
            shell=shell,
            cli=cli,
            plan_mode=plan_mode,
            runtime_status="none",
        )
        self.db.add(session)
        await self.db.flush()
        await self.db.refresh(session)
        return session

    async def update(self, session_id: uuid.UUID, **kwargs: object) -> TaskSession:
        session = await self.get(session_id)
        allowed = {"runtime_status", "pid", "exit_code", "claude_session_id", "plan_mode", "started_at", "stopped_at"}
        for field, value in kwargs.items():
            if field in allowed:
                setattr(session, field, value)
        await self.db.flush()
        await self.db.refresh(session)
        return session

    async def delete(self, session_id: uuid.UUID) -> None:
        session = await self.get(session_id)
        await self.db.delete(session)
        await self.db.flush()
