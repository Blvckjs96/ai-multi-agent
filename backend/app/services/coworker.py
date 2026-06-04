"""Coworker service — CRUD for AI persona records."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.models.coworker import Coworker


class CoworkerService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(self, user_id: UUID) -> list[Coworker]:
        result = await self.db.execute(
            select(Coworker).where(Coworker.user_id == user_id).order_by(Coworker.created_at)
        )
        return list(result.scalars().all())

    async def get(self, coworker_id: UUID, user_id: UUID) -> Coworker:
        result = await self.db.execute(
            select(Coworker).where(Coworker.id == coworker_id, Coworker.user_id == user_id)
        )
        cw = result.scalar_one_or_none()
        if not cw:
            raise NotFoundError(message="Coworker not found", details={"id": str(coworker_id)})
        return cw

    async def create(
        self,
        user_id: UUID,
        *,
        name: str,
        role: str,
        system_prompt: str,
        model: str = "sonnet",
        knowledge_ids: list[str] | None = None,
        tool_ids: list[str] | None = None,
        skill_ids: list[str] | None = None,
    ) -> Coworker:
        cw = Coworker(
            user_id=user_id,
            name=name,
            role=role,
            system_prompt=system_prompt,
            model=model,
            knowledge_ids=knowledge_ids or [],
            tool_ids=tool_ids or [],
            skill_ids=skill_ids or [],
        )
        self.db.add(cw)
        await self.db.flush()
        await self.db.refresh(cw)
        return cw

    async def update(
        self, coworker_id: UUID, user_id: UUID, data: dict
    ) -> Coworker:
        cw = await self.get(coworker_id, user_id)
        for field, value in data.items():
            if value is not None:
                setattr(cw, field, value)
        await self.db.flush()
        await self.db.refresh(cw)
        return cw

    async def delete(self, coworker_id: UUID, user_id: UUID) -> None:
        cw = await self.get(coworker_id, user_id)
        await self.db.delete(cw)
        await self.db.flush()
