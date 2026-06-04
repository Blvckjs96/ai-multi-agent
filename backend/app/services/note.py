"""Note service — business logic."""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.models.note import Note
from app.repositories import note as note_repo


class NoteService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(
        self, user_id: str, workspace_id: str | None = None
    ) -> list[Note]:
        return await note_repo.get_all(self.db, user_id=user_id, workspace_id=workspace_id)

    async def get(self, note_id: uuid.UUID, user_id: str) -> Note:
        note = await note_repo.get_by_id(self.db, note_id=note_id, user_id=user_id)
        if not note:
            raise NotFoundError(
                message="Note not found", details={"note_id": str(note_id)}
            )
        return note

    async def create(
        self,
        user_id: str,
        *,
        workspace_id: str | None = None,
        title: str = "Untitled",
        content: str = "",
    ) -> Note:
        return await note_repo.create(
            self.db,
            user_id=user_id,
            workspace_id=workspace_id,
            title=title,
            content=content,
        )

    async def update(
        self,
        note_id: uuid.UUID,
        user_id: str,
        *,
        title: str | None = None,
        content: str | None = None,
        pinned: bool | None = None,
    ) -> Note:
        note = await self.get(note_id, user_id)
        return await note_repo.update(
            self.db, note=note, title=title, content=content, pinned=pinned
        )

    async def delete(self, note_id: uuid.UUID, user_id: str) -> None:
        note = await self.get(note_id, user_id)
        await note_repo.delete(self.db, note=note)

    async def toggle_pin(self, note_id: uuid.UUID, user_id: str) -> Note:
        note = await self.get(note_id, user_id)
        return await note_repo.update(self.db, note=note, pinned=not note.pinned)
