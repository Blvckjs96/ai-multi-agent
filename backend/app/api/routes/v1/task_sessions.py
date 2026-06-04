"""TaskSession endpoints — per-issue PTY/CLI session tracking."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Query, status
from pydantic import BaseModel

from app.api.deps import DBSession, ValidAPIKey
from app.services.task_session import TaskSessionService

router = APIRouter(prefix="/task-sessions", tags=["task-sessions"])


class TaskSessionCreate(BaseModel):
    task_id: UUID
    workspace_id: UUID
    shell: str = "zsh"
    cli: str = "claude"
    plan_mode: bool = False


class TaskSessionUpdate(BaseModel):
    runtime_status: str | None = None
    pid: int | None = None
    exit_code: int | None = None
    claude_session_id: str | None = None
    plan_mode: bool | None = None


class TaskSessionRead(BaseModel):
    id: UUID
    task_id: UUID
    workspace_id: UUID
    shell: str
    cli: str
    runtime_status: str
    pid: int | None = None
    exit_code: int | None = None
    claude_session_id: str | None = None
    plan_mode: bool

    model_config = {"from_attributes": True}


class TaskSessionList(BaseModel):
    items: list[TaskSessionRead]
    total: int


@router.get("", response_model=TaskSessionList)
async def list_sessions(
    db: DBSession,
    api_key: ValidAPIKey,
    task_id: UUID | None = Query(None),
    workspace_id: UUID | None = Query(None),
) -> Any:
    items = await TaskSessionService(db).list(task_id=task_id, workspace_id=workspace_id)
    return TaskSessionList(items=items, total=len(items))


@router.post("", response_model=TaskSessionRead, status_code=status.HTTP_201_CREATED)
async def create_session(body: TaskSessionCreate, db: DBSession, api_key: ValidAPIKey) -> Any:
    return await TaskSessionService(db).create(
        task_id=body.task_id,
        workspace_id=body.workspace_id,
        shell=body.shell,
        cli=body.cli,
        plan_mode=body.plan_mode,
    )


@router.patch("/{session_id}", response_model=TaskSessionRead)
async def update_session(
    session_id: UUID, body: TaskSessionUpdate, db: DBSession, api_key: ValidAPIKey
) -> Any:
    return await TaskSessionService(db).update(session_id, **body.model_dump(exclude_none=True))


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_session(session_id: UUID, db: DBSession, api_key: ValidAPIKey) -> None:
    await TaskSessionService(db).delete(session_id)
