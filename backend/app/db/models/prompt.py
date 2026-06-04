"""Prompt model — user-defined prompt templates with variable placeholders."""
from __future__ import annotations
import uuid
from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin


class Prompt(Base, TimestampMixin):
    __tablename__ = "prompts"
    id:          Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id:     Mapped[str]       = mapped_column(String(36), nullable=False, index=True)
    name:        Mapped[str]       = mapped_column(String(100), nullable=False)
    description: Mapped[str]       = mapped_column(String(500), nullable=False, default="")
    content:     Mapped[str]       = mapped_column(Text, nullable=False, default="")

    def __repr__(self) -> str:
        return f"<Prompt(id={self.id}, name={self.name!r})>"
