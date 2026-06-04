"""Tools CRUD + sandboxed test runner.

GET    /tools             list user tools
POST   /tools             create tool
GET    /tools/{id}        get tool
PATCH  /tools/{id}        update tool
DELETE /tools/{id}        delete tool
POST   /tools/{id}/test   run tool code with provided args (sandboxed)
"""
from __future__ import annotations
import json
import subprocess
import sys
import tempfile
import textwrap
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, status
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, DBSession, ToolSvc

router = APIRouter(prefix="/tools", tags=["tools"])


class ToolCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    code: str = Field(default="")


class ToolUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    code: str | None = None


class ToolRead(BaseModel):
    id: UUID
    name: str
    description: str
    code: str
    created_at: datetime
    updated_at: datetime | None = None
    model_config = {"from_attributes": True}


class ToolList(BaseModel):
    items: list[ToolRead]
    total: int


class TestRequest(BaseModel):
    args: dict[str, Any] = Field(default_factory=dict)


class TestResult(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    error: str | None = None


@router.get("", response_model=ToolList)
async def list_tools(user: CurrentUser, service: ToolSvc) -> Any:
    tools = await service.list(str(user.id))
    return ToolList(items=tools, total=len(tools))


@router.post("", response_model=ToolRead, status_code=status.HTTP_201_CREATED)
async def create_tool(body: ToolCreate, user: CurrentUser, service: ToolSvc) -> Any:
    return await service.create(str(user.id), name=body.name, description=body.description, code=body.code)


@router.get("/{tool_id}", response_model=ToolRead)
async def get_tool(tool_id: UUID, user: CurrentUser, service: ToolSvc) -> Any:
    return await service.get(tool_id, str(user.id))


@router.patch("/{tool_id}", response_model=ToolRead)
async def update_tool(tool_id: UUID, body: ToolUpdate, user: CurrentUser, service: ToolSvc) -> Any:
    return await service.update(tool_id, str(user.id), name=body.name, description=body.description, code=body.code)


@router.delete("/{tool_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_tool(tool_id: UUID, user: CurrentUser, service: ToolSvc) -> None:
    await service.delete(tool_id, str(user.id))


@router.post("/{tool_id}/test", response_model=TestResult)
async def test_tool(tool_id: UUID, body: TestRequest, user: CurrentUser, service: ToolSvc) -> Any:
    """Run the tool's Python code in a sandboxed subprocess with a 10s timeout."""
    tool = await service.get(tool_id, str(user.id))

    # Build a wrapper: inject args as locals, execute user code, print result
    wrapper = textwrap.dedent(f"""
        import json, sys
        _args = {json.dumps(body.args)}
        {tool.code}
    """)

    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(wrapper)
            tmp_path = f.name

        result = subprocess.run(
            [sys.executable, tmp_path],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return TestResult(
            stdout=result.stdout[:4096],
            stderr=result.stderr[:2048],
            exit_code=result.returncode,
        )
    except subprocess.TimeoutExpired:
        return TestResult(stdout="", stderr="", exit_code=-1, error="Execution timed out (10s limit)")
    except Exception as exc:
        return TestResult(stdout="", stderr="", exit_code=-1, error=str(exc))
    finally:
        import os
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
