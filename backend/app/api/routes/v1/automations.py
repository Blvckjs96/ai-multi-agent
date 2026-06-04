"""Automations API — CRUD + manual trigger."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field

from app.api.deps import CurrentUser, DBSession
from app.services.automation import AutomationService

router = APIRouter(prefix="/automations", tags=["automations"])


# ---------------------------------------------------------------------------
# Schemas (inline — small enough not to need a separate file)
# ---------------------------------------------------------------------------


class AutomationBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str = Field(max_length=255)
    workspace_id: str | None = None
    schedule_cron: str | None = Field(default=None, max_length=100)
    model_id: str | None = Field(default=None, max_length=100)
    prompt: str = ""
    enabled: bool = True


class AutomationCreate(AutomationBase):
    pass


class AutomationUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str | None = Field(default=None, max_length=255)
    workspace_id: str | None = None
    schedule_cron: str | None = None
    model_id: str | None = None
    prompt: str | None = None
    enabled: bool | None = None


class AutomationRead(AutomationBase):
    id: uuid.UUID
    user_id: str
    last_run_at: str | None = None
    last_result: str | None = None


class AutomationList(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: list[AutomationRead]
    total: int


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("", response_model=AutomationList)
async def list_automations(
    user: CurrentUser,
    db: DBSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
) -> Any:
    svc = AutomationService(db)
    items, total = await svc.list(user_id=str(user.id), skip=skip, limit=limit)
    return AutomationList(items=items, total=total)


@router.post("", response_model=AutomationRead, status_code=status.HTTP_201_CREATED)
async def create_automation(
    body: AutomationCreate,
    user: CurrentUser,
    db: DBSession,
    request: Request,
) -> Any:
    db_factory = request.app.state.db_factory if hasattr(request.app.state, "db_factory") else None
    svc = AutomationService(db)
    return await svc.create(
        user_id=str(user.id),
        workspace_id=body.workspace_id,
        name=body.name,
        schedule_cron=body.schedule_cron,
        model_id=body.model_id,
        prompt=body.prompt,
        enabled=body.enabled,
        db_factory=db_factory,
    )


@router.get("/{automation_id}", response_model=AutomationRead)
async def get_automation(
    automation_id: uuid.UUID,
    user: CurrentUser,
    db: DBSession,
) -> Any:
    svc = AutomationService(db)
    return await svc.get(automation_id, user_id=str(user.id))


@router.patch("/{automation_id}", response_model=AutomationRead)
async def update_automation(
    automation_id: uuid.UUID,
    body: AutomationUpdate,
    user: CurrentUser,
    db: DBSession,
    request: Request,
) -> Any:
    db_factory = request.app.state.db_factory if hasattr(request.app.state, "db_factory") else None
    svc = AutomationService(db)
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    return await svc.update(
        automation_id, user_id=str(user.id), update_data=update_data, db_factory=db_factory
    )


@router.delete("/{automation_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_automation(
    automation_id: uuid.UUID,
    user: CurrentUser,
    db: DBSession,
) -> None:
    svc = AutomationService(db)
    await svc.delete(automation_id, user_id=str(user.id))


@router.post("/{automation_id}/trigger", response_model=AutomationRead)
async def trigger_automation(
    automation_id: uuid.UUID,
    user: CurrentUser,
    db: DBSession,
) -> Any:
    svc = AutomationService(db)
    return await svc.trigger(automation_id, user_id=str(user.id))
