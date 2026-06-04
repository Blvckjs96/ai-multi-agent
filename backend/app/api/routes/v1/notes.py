"""Notes CRUD endpoints.

GET    /notes              list user notes
POST   /notes              create note
GET    /notes/{note_id}    get note
PATCH  /notes/{note_id}    update note
DELETE /notes/{note_id}    delete note
POST   /notes/{note_id}/pin  toggle pin
"""
from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Query, status
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, DBSession
from app.services.note import NoteService

router = APIRouter(prefix="/notes", tags=["notes"])


class NoteCreate(BaseModel):
    title: str = Field(default="Untitled", max_length=500)
    content: str = Field(default="")
    workspace_id: str | None = None


class NoteUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=500)
    content: str | None = None
    pinned: bool | None = None


class NoteRead(BaseModel):
    id: UUID
    user_id: str
    workspace_id: str | None = None
    title: str
    content: str
    pinned: bool

    model_config = {"from_attributes": True}


class NoteList(BaseModel):
    items: list[NoteRead]
    total: int


@router.get("", response_model=NoteList)
async def list_notes(
    user: CurrentUser,
    db: DBSession,
    workspace_id: str | None = Query(default=None),
) -> Any:
    notes = await NoteService(db).list(str(user.id), workspace_id=workspace_id)
    return NoteList(items=notes, total=len(notes))


@router.post("", response_model=NoteRead, status_code=status.HTTP_201_CREATED)
async def create_note(body: NoteCreate, user: CurrentUser, db: DBSession) -> Any:
    return await NoteService(db).create(
        str(user.id),
        workspace_id=body.workspace_id,
        title=body.title,
        content=body.content,
    )


@router.get("/{note_id}", response_model=NoteRead)
async def get_note(note_id: UUID, user: CurrentUser, db: DBSession) -> Any:
    return await NoteService(db).get(note_id, str(user.id))


@router.patch("/{note_id}", response_model=NoteRead)
async def update_note(
    note_id: UUID, body: NoteUpdate, user: CurrentUser, db: DBSession
) -> Any:
    return await NoteService(db).update(
        note_id,
        str(user.id),
        title=body.title,
        content=body.content,
        pinned=body.pinned,
    )


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_note(note_id: UUID, user: CurrentUser, db: DBSession) -> None:
    await NoteService(db).delete(note_id, str(user.id))


@router.post("/{note_id}/pin", response_model=NoteRead)
async def toggle_pin(note_id: UUID, user: CurrentUser, db: DBSession) -> Any:
    return await NoteService(db).toggle_pin(note_id, str(user.id))
