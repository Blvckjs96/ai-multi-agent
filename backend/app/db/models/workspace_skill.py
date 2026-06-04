"""WorkspaceSkill model — user-defined skill instructions callable as context."""
from __future__ import annotations
import uuid
from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin


class WorkspaceSkill(Base, TimestampMixin):
    __tablename__ = "workspace_skills"
    id:          Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id:     Mapped[str]       = mapped_column(String(36), nullable=False, index=True)
    name:        Mapped[str]       = mapped_column(String(100), nullable=False)
    description: Mapped[str]       = mapped_column(String(500), nullable=False, default="")
    content:     Mapped[str]       = mapped_column(Text, nullable=False, default="")

    def __repr__(self) -> str:
        return f"<WorkspaceSkill(id={self.id}, name={self.name!r})>"
