"""Codegraph API — status and lifecycle management for per-workspace MCP servers."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.api.deps import CurrentUser
from app.services.codegraph_service import codegraph_service

router = APIRouter(prefix="/codegraph", tags=["codegraph"])


class CodegraphStatus(BaseModel):
    workspace_id: str
    running: bool
    port: int | None
    bin_exists: bool


class CodegraphStartResponse(BaseModel):
    workspace_id: str
    port: int
    message: str


@router.get("/{workspace_id}/status", response_model=CodegraphStatus)
async def get_codegraph_status(
    workspace_id: UUID,
    _: CurrentUser,
) -> Any:
    """Return the running status of the codegraph MCP server for a workspace."""
    return codegraph_service.status(workspace_id)


@router.post("/{workspace_id}/start", response_model=CodegraphStartResponse)
async def start_codegraph(
    workspace_id: UUID,
    repo_path: str,
    _: CurrentUser,
) -> Any:
    """Start (or re-use) the codegraph MCP server for a workspace.

    `repo_path` must be an absolute path to the workspace's git root.
    Returns the SSE port that Claude can connect to.
    """
    try:
        port = await codegraph_service.ensure_running(workspace_id, repo_path)
        return CodegraphStartResponse(
            workspace_id=str(workspace_id),
            port=port,
            message="Codegraph MCP server running",
        )
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{workspace_id}/stop", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def stop_codegraph(
    workspace_id: UUID,
    _: CurrentUser,
) -> None:
    """Stop the codegraph MCP server for a workspace."""
    await codegraph_service.stop(workspace_id)
