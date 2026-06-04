"""Task board service — Kanban tasks per workspace."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.models.task import Task, TaskPriority, TaskStatus, TaskStep


class TaskBoardService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(self, workspace_id: uuid.UUID) -> list[Task]:
        result = await self.db.execute(
            select(Task)
            .where(Task.workspace_id == workspace_id)
            .order_by(Task.status, Task.position)
        )
        return list(result.scalars().all())

    async def get(self, task_id: uuid.UUID) -> Task:
        result = await self.db.execute(select(Task).where(Task.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            raise NotFoundError(message="Task not found", details={"task_id": str(task_id)})
        return task

    async def create(
        self,
        workspace_id: uuid.UUID,
        title: str,
        *,
        description: str | None = None,
        status: str = TaskStatus.TODO,
        priority: str = TaskPriority.MEDIUM,
        session_id: str | None = None,
        step: str = TaskStep.BACKLOG,
        cwd: str | None = None,
        worktree_strategy: str | None = None,
        worktree_path: str | None = None,
        worktree_name: str | None = None,
        base_branch: str | None = None,
        external_provider: str | None = None,
        external_id: str | None = None,
        external_key: str | None = None,
        external_url: str | None = None,
        sort_order: float = 0.0,
    ) -> Task:
        # Set position at end of column
        result = await self.db.execute(
            select(Task)
            .where(Task.workspace_id == workspace_id, Task.status == status)
            .order_by(Task.position.desc())
            .limit(1)
        )
        last = result.scalar_one_or_none()
        position = (last.position + 1) if last else 0

        task = Task(
            workspace_id=workspace_id,
            title=title,
            description=description,
            status=status,
            priority=priority,
            position=position,
            session_id=session_id,
            step=step,
            cwd=cwd,
            worktree_strategy=worktree_strategy,
            worktree_path=worktree_path,
            worktree_name=worktree_name,
            base_branch=base_branch,
            external_provider=external_provider,
            external_id=external_id,
            external_key=external_key,
            external_url=external_url,
            sort_order=sort_order,
        )
        self.db.add(task)
        await self.db.flush()
        await self.db.refresh(task)
        return task

    async def update(self, task_id: uuid.UUID, **kwargs: object) -> Task:
        task = await self.get(task_id)
        allowed = {
            "title", "description", "status", "priority", "position", "assignee",
            "step", "cwd", "worktree_strategy", "worktree_path", "worktree_name",
            "base_branch", "external_provider", "external_id", "external_key",
            "external_url", "sort_order",
        }
        for field, value in kwargs.items():
            if field in allowed and value is not None:
                setattr(task, field, value)
        await self.db.flush()
        await self.db.refresh(task)
        return task

    async def delete(self, task_id: uuid.UUID) -> None:
        task = await self.get(task_id)
        await self.db.delete(task)
        await self.db.flush()
