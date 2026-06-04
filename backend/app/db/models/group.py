"""Group model for role-based access control."""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Group(Base, TimestampMixin):
    """A named group of users with a shared permission dict.

    member_ids: list of user UUID strings.
    permissions: nested dict matching DEFAULT_USER_PERMISSIONS shape.
    """

    __tablename__ = "groups"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    member_ids: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    permissions: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    def __repr__(self) -> str:
        return f"<Group(id={self.id}, name={self.name!r})>"
