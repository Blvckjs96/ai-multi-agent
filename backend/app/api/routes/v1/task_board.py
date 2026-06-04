"""Task board endpoints — Kanban tasks per workspace."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, status
from pydantic import BaseModel

from app.api.deps import DBSession, ValidAPIKey
from app.services.task_board import TaskBoardService

router = APIRouter(prefix="/tasks", tags=["tasks"])


class TaskCreate(BaseModel):
    workspace_id: UUID
    title: str
    description: str | None = None
    status: str = "todo"
    priority: str = "medium"
    session_id: str | None = None
    # Extended fields
    step: str = "backlog"
    cwd: str | None = None
    worktree_strategy: str | None = None
    worktree_path: str | None = None
    worktree_name: str | None = None
    base_branch: str | None = None
    external_provider: str | None = None
    external_id: str | None = None
    external_key: str | None = None
    external_url: str | None = None
    sort_order: float = 0.0


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    position: int | None = None
    # Extended fields
    step: str | None = None
    cwd: str | None = None
    worktree_strategy: str | None = None
    worktree_path: str | None = None
    worktree_name: str | None = None
    base_branch: str | None = None
    external_provider: str | None = None
    external_id: str | None = None
    external_key: str | None = None
    external_url: str | None = None
    sort_order: float | None = None


class TaskRead(BaseModel):
    id: UUID
    workspace_id: UUID
    title: str
    description: str | None = None
    status: str
    priority: str
    position: int
    session_id: str | None = None
    assignee: str | None = None
    # Extended fields
    step: str = "backlog"
    cwd: str | None = None
    worktree_strategy: str | None = None
    worktree_path: str | None = None
    worktree_name: str | None = None
    base_branch: str | None = None
    external_provider: str | None = None
    external_id: str | None = None
    external_key: str | None = None
    external_url: str | None = None
    sort_order: float = 0.0
    # Enriched at read time
    runtime_status: str | None = None

    model_config = {"from_attributes": True}


@router.get("/{workspace_id}", response_model=list[TaskRead])
async def list_tasks(workspace_id: UUID, db: DBSession, api_key: ValidAPIKey) -> Any:
    return await TaskBoardService(db).list(workspace_id)


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(body: TaskCreate, db: DBSession, api_key: ValidAPIKey) -> Any:
    return await TaskBoardService(db).create(
        body.workspace_id,
        body.title,
        description=body.description,
        status=body.status,
        priority=body.priority,
        session_id=body.session_id,
        step=body.step,
        cwd=body.cwd,
        worktree_strategy=body.worktree_strategy,
        worktree_path=body.worktree_path,
        worktree_name=body.worktree_name,
        base_branch=body.base_branch,
        external_provider=body.external_provider,
        external_id=body.external_id,
        external_key=body.external_key,
        external_url=body.external_url,
        sort_order=body.sort_order,
    )


@router.patch("/{task_id}", response_model=TaskRead)
async def update_task(task_id: UUID, body: TaskUpdate, db: DBSession, api_key: ValidAPIKey) -> Any:
    return await TaskBoardService(db).update(task_id, **body.model_dump(exclude_none=True))


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_task(task_id: UUID, db: DBSession, api_key: ValidAPIKey) -> None:
    await TaskBoardService(db).delete(task_id)
