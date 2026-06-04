"""Coworker (AI persona) CRUD endpoints."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, status
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, DBSession
from app.services.coworker import CoworkerService

router = APIRouter(prefix="/coworkers", tags=["coworkers"])


# ── Schemas ───────────────────────────────────────────────────────────────────


class CoworkerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    role: str = Field(min_length=1, max_length=50)
    system_prompt: str = Field(default="")
    model: str = Field(default="sonnet", max_length=50)
    knowledge_ids: list[str] = Field(default_factory=list)
    tool_ids: list[str] = Field(default_factory=list)
    skill_ids: list[str] = Field(default_factory=list)


class CoworkerUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    role: str | None = Field(default=None, max_length=50)
    system_prompt: str | None = None
    model: str | None = Field(default=None, max_length=50)
    knowledge_ids: list[str] | None = None
    tool_ids: list[str] | None = None
    skill_ids: list[str] | None = None


class CoworkerRead(BaseModel):
    id: UUID
    name: str
    role: str
    system_prompt: str
    model: str
    knowledge_ids: list[str] = Field(default_factory=list)
    tool_ids: list[str] = Field(default_factory=list)
    skill_ids: list[str] = Field(default_factory=list)

    model_config = {"from_attributes": True}


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("", response_model=list[CoworkerRead])
async def list_coworkers(user: CurrentUser, db: DBSession) -> Any:
    return await CoworkerService(db).list(user.id)


@router.post("", response_model=CoworkerRead, status_code=status.HTTP_201_CREATED)
async def create_coworker(body: CoworkerCreate, user: CurrentUser, db: DBSession) -> Any:
    return await CoworkerService(db).create(
        user.id,
        name=body.name,
        role=body.role,
        system_prompt=body.system_prompt,
        model=body.model,
        knowledge_ids=body.knowledge_ids,
        tool_ids=body.tool_ids,
        skill_ids=body.skill_ids,
    )


@router.patch("/{coworker_id}", response_model=CoworkerRead)
async def update_coworker(
    coworker_id: UUID, body: CoworkerUpdate, user: CurrentUser, db: DBSession
) -> Any:
    return await CoworkerService(db).update(coworker_id, user.id, body.model_dump(exclude_none=True))


@router.delete("/{coworker_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_coworker(coworker_id: UUID, user: CurrentUser, db: DBSession) -> None:
    await CoworkerService(db).delete(coworker_id, user.id)
