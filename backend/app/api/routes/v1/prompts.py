"""Prompts CRUD.

GET    /prompts             list user prompts
POST   /prompts             create prompt
GET    /prompts/{id}        get prompt
PATCH  /prompts/{id}        update prompt
DELETE /prompts/{id}        delete prompt
"""
from __future__ import annotations
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, status
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, PromptSvc

router = APIRouter(prefix="/prompts", tags=["prompts"])


class PromptCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    content: str = Field(default="")


class PromptUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    content: str | None = None


class PromptRead(BaseModel):
    id: UUID
    name: str
    description: str
    content: str
    created_at: datetime
    updated_at: datetime | None = None
    model_config = {"from_attributes": True}


class PromptList(BaseModel):
    items: list[PromptRead]
    total: int


@router.get("", response_model=PromptList)
async def list_prompts(user: CurrentUser, service: PromptSvc) -> Any:
    prompts = await service.list(str(user.id))
    return PromptList(items=prompts, total=len(prompts))


@router.post("", response_model=PromptRead, status_code=status.HTTP_201_CREATED)
async def create_prompt(body: PromptCreate, user: CurrentUser, service: PromptSvc) -> Any:
    return await service.create(str(user.id), name=body.name, description=body.description, content=body.content)


@router.get("/{prompt_id}", response_model=PromptRead)
async def get_prompt(prompt_id: UUID, user: CurrentUser, service: PromptSvc) -> Any:
    return await service.get(prompt_id, str(user.id))


@router.patch("/{prompt_id}", response_model=PromptRead)
async def update_prompt(prompt_id: UUID, body: PromptUpdate, user: CurrentUser, service: PromptSvc) -> Any:
    return await service.update(prompt_id, str(user.id), name=body.name, description=body.description, content=body.content)


@router.delete("/{prompt_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_prompt(prompt_id: UUID, user: CurrentUser, service: PromptSvc) -> None:
    await service.delete(prompt_id, str(user.id))
