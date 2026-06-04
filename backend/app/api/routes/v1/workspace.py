"""Workspace CRUD endpoints."""

import asyncio
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi import APIRouter, status
from pydantic import BaseModel

from app.api.deps import DBSession, ValidAPIKey
from app.services.workspace import WorkspaceService

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


class WorkspaceCreate(BaseModel):
    name: str
    path: str
    description: str | None = None


class WorkspaceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class WorkspaceRead(BaseModel):
    id: UUID
    name: str
    path: str
    description: str | None = None
    is_active: bool

    model_config = {"from_attributes": True}


@router.get("", response_model=list[WorkspaceRead])
async def list_workspaces(db: DBSession, api_key: ValidAPIKey) -> Any:
    return await WorkspaceService(db).list()


@router.post("", response_model=WorkspaceRead, status_code=status.HTTP_201_CREATED)
async def create_workspace(body: WorkspaceCreate, db: DBSession, api_key: ValidAPIKey) -> Any:
    return await WorkspaceService(db).create(body.name, body.path, body.description)


@router.get("/{workspace_id}", response_model=WorkspaceRead)
async def get_workspace(workspace_id: UUID, db: DBSession, api_key: ValidAPIKey) -> Any:
    return await WorkspaceService(db).get(workspace_id)


@router.patch("/{workspace_id}", response_model=WorkspaceRead)
async def update_workspace(
    workspace_id: UUID, body: WorkspaceUpdate, db: DBSession, api_key: ValidAPIKey
) -> Any:
    return await WorkspaceService(db).update(workspace_id, **body.model_dump(exclude_none=True))


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_workspace(workspace_id: UUID, db: DBSession, api_key: ValidAPIKey) -> None:
    await WorkspaceService(db).delete(workspace_id)


class GitDiffResponse(BaseModel):
    diff: str
    status_output: str
    has_changes: bool


@router.get("/{workspace_id}/git-diff", response_model=GitDiffResponse)
async def get_workspace_git_diff(workspace_id: UUID, db: DBSession, api_key: ValidAPIKey) -> Any:
    """Return the current git diff for a workspace — shown in the Plan/Confirm preview."""
    workspace = await WorkspaceService(db).get(workspace_id)
    workspace_path = Path(workspace.path)

    if not workspace_path.exists():
        return GitDiffResponse(diff="", status_output="", has_changes=False)

    try:
        diff_proc, status_proc = await asyncio.gather(
            asyncio.create_subprocess_exec(
                "git", "diff", "HEAD",
                cwd=str(workspace_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            ),
            asyncio.create_subprocess_exec(
                "git", "status", "--short",
                cwd=str(workspace_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            ),
        )
        (diff_out, _), (status_out, _) = await asyncio.gather(
            asyncio.wait_for(diff_proc.communicate(), timeout=10),
            asyncio.wait_for(status_proc.communicate(), timeout=5),
        )
    except Exception:
        return GitDiffResponse(diff="", status_output="", has_changes=False)

    diff_text = diff_out.decode("utf-8", errors="replace")
    status_text = status_out.decode("utf-8", errors="replace")

    return GitDiffResponse(
        diff=diff_text[:20_000],
        status_output=status_text[:2_000],
        has_changes=bool(diff_text.strip() or status_text.strip()),
    )
