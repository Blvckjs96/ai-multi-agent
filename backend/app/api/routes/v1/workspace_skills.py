"""Workspace Skills CRUD.

GET    /skills             list user skills
POST   /skills             create skill
GET    /skills/{id}        get skill
PATCH  /skills/{id}        update skill
DELETE /skills/{id}        delete skill
"""
from __future__ import annotations
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, status
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, WorkspaceSkillSvc

router = APIRouter(prefix="/skills", tags=["skills"])


class SkillCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    content: str = Field(default="")


class SkillUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    content: str | None = None


class SkillRead(BaseModel):
    id: UUID
    name: str
    description: str
    content: str
    created_at: datetime
    updated_at: datetime | None = None
    model_config = {"from_attributes": True}


class SkillList(BaseModel):
    items: list[SkillRead]
    total: int


@router.get("", response_model=SkillList)
async def list_skills(user: CurrentUser, service: WorkspaceSkillSvc) -> Any:
    skills = await service.list(str(user.id))
    return SkillList(items=skills, total=len(skills))


@router.post("", response_model=SkillRead, status_code=status.HTTP_201_CREATED)
async def create_skill(body: SkillCreate, user: CurrentUser, service: WorkspaceSkillSvc) -> Any:
    return await service.create(str(user.id), name=body.name, description=body.description, content=body.content)


@router.get("/{skill_id}", response_model=SkillRead)
async def get_skill(skill_id: UUID, user: CurrentUser, service: WorkspaceSkillSvc) -> Any:
    return await service.get(skill_id, str(user.id))


@router.patch("/{skill_id}", response_model=SkillRead)
async def update_skill(skill_id: UUID, body: SkillUpdate, user: CurrentUser, service: WorkspaceSkillSvc) -> Any:
    return await service.update(skill_id, str(user.id), name=body.name, description=body.description, content=body.content)


@router.delete("/{skill_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_skill(skill_id: UUID, user: CurrentUser, service: WorkspaceSkillSvc) -> None:
    await service.delete(skill_id, str(user.id))
