"""WorkspaceSkill service."""
from __future__ import annotations
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.workspace_skill import WorkspaceSkill
from app.repositories import workspace_skill as skill_repo
from app.core.exceptions import NotFoundError


class WorkspaceSkillService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(self, user_id: str) -> list[WorkspaceSkill]:
        return await skill_repo.get_all(self.db, user_id=user_id)

    async def get(self, skill_id: uuid.UUID, user_id: str) -> WorkspaceSkill:
        skill = await skill_repo.get_by_id(self.db, skill_id=skill_id, user_id=user_id)
        if not skill:
            raise NotFoundError(message="Skill not found", details={"skill_id": str(skill_id)})
        return skill

    async def create(self, user_id: str, *, name: str, description: str = "", content: str = "") -> WorkspaceSkill:
        return await skill_repo.create(self.db, user_id=user_id, name=name, description=description, content=content)

    async def update(
        self,
        skill_id: uuid.UUID,
        user_id: str,
        *,
        name: str | None = None,
        description: str | None = None,
        content: str | None = None,
    ) -> WorkspaceSkill:
        skill = await self.get(skill_id, user_id)
        return await skill_repo.update(self.db, skill=skill, name=name, description=description, content=content)

    async def delete(self, skill_id: uuid.UUID, user_id: str) -> None:
        skill = await self.get(skill_id, user_id)
        await skill_repo.delete(self.db, skill=skill)
