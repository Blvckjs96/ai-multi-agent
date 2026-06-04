"""Prompt service."""
from __future__ import annotations
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.prompt import Prompt
from app.repositories import prompt as prompt_repo
from app.core.exceptions import NotFoundError


class PromptService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(self, user_id: str) -> list[Prompt]:
        return await prompt_repo.get_all(self.db, user_id=user_id)

    async def get(self, prompt_id: uuid.UUID, user_id: str) -> Prompt:
        prompt = await prompt_repo.get_by_id(self.db, prompt_id=prompt_id, user_id=user_id)
        if not prompt:
            raise NotFoundError(message="Prompt not found", details={"prompt_id": str(prompt_id)})
        return prompt

    async def create(self, user_id: str, *, name: str, description: str = "", content: str = "") -> Prompt:
        return await prompt_repo.create(self.db, user_id=user_id, name=name, description=description, content=content)

    async def update(
        self,
        prompt_id: uuid.UUID,
        user_id: str,
        *,
        name: str | None = None,
        description: str | None = None,
        content: str | None = None,
    ) -> Prompt:
        prompt = await self.get(prompt_id, user_id)
        return await prompt_repo.update(self.db, prompt=prompt, name=name, description=description, content=content)

    async def delete(self, prompt_id: uuid.UUID, user_id: str) -> None:
        prompt = await self.get(prompt_id, user_id)
        await prompt_repo.delete(self.db, prompt=prompt)
