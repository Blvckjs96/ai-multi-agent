"""Change timeline endpoints — per-workspace git-backed change history."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, status
from pydantic import BaseModel

from app.api.deps import DBSession, ValidAPIKey
from app.services.change_log_svc import ChangeLogService
from app.services.workspace import WorkspaceService

router = APIRouter(prefix="/timeline", tags=["timeline"])


class RecordRequest(BaseModel):
    workspace_id: UUID
    prompt: str
    session_id: str | None = None


class CommitRequest(BaseModel):
    commit_message: str | None = None


class ChangeLogRead(BaseModel):
    id: UUID
    workspace_id: UUID
    session_id: str | None = None
    prompt: str
    git_commit_hash: str | None = None
    status: str
    files_changed: list | None = None

    model_config = {"from_attributes": True}


@router.get("/{workspace_id}", response_model=list[ChangeLogRead])
async def list_changes(
    workspace_id: UUID, db: DBSession, api_key: ValidAPIKey, skip: int = 0, limit: int = 50
) -> Any:
    return await ChangeLogService(db).list(workspace_id, limit=limit, skip=skip)


@router.post("", response_model=ChangeLogRead, status_code=status.HTTP_201_CREATED)
async def record_change(body: RecordRequest, db: DBSession, api_key: ValidAPIKey) -> Any:
    return await ChangeLogService(db).record(body.workspace_id, body.prompt, body.session_id)


@router.post("/{log_id}/commit", response_model=ChangeLogRead)
async def commit_change(
    log_id: UUID, body: CommitRequest, db: DBSession, api_key: ValidAPIKey
) -> Any:
    svc = ChangeLogService(db)
    entry = await svc._get(log_id)
    ws = await WorkspaceService(db).get(entry.workspace_id)
    return await svc.commit(log_id, ws.path, body.commit_message)


@router.post("/{log_id}/revert", response_model=ChangeLogRead)
async def revert_change(log_id: UUID, db: DBSession, api_key: ValidAPIKey) -> Any:
    svc = ChangeLogService(db)
    entry = await svc._get(log_id)
    ws = await WorkspaceService(db).get(entry.workspace_id)
    return await svc.revert(log_id, ws.path)


@router.get("/{log_id}/diff")
async def get_diff(log_id: UUID, db: DBSession, api_key: ValidAPIKey) -> Any:
    diff = await ChangeLogService(db).get_diff(log_id)
    return {"diff": diff}
