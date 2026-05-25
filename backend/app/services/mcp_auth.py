"""MCP token authentication service for Chiron MCP server."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ResolvedIdentity:
    user_id: UUID
    email: str


class MCPAuthService:
    """Verifies mcp_token and resolves the authorized user."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def verify_token(self, token: str | None) -> ResolvedIdentity | None:
        if not token:
            return None

        result = await self.db.execute(
            select(User).where(User.mcp_token == token, User.is_active.is_(True))
        )
        user = result.scalar_one_or_none()
        if user is None:
            return None

        return ResolvedIdentity(user_id=user.id, email=user.email)
