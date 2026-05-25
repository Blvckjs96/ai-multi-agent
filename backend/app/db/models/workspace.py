"""Workspace model — one workspace = one git repository."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.change_log import ChangeLog
    from app.db.models.chiron import ChironSource, ChironWikiPage
    from app.db.models.task import Task


class Workspace(Base, TimestampMixin):
    __tablename__ = "workspaces"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    path: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    sources: Mapped[list["ChironSource"]] = relationship(
        "ChironSource", back_populates="workspace", cascade="all, delete-orphan"
    )
    wiki_pages: Mapped[list["ChironWikiPage"]] = relationship(
        "ChironWikiPage", back_populates="workspace", cascade="all, delete-orphan"
    )
    change_logs: Mapped[list["ChangeLog"]] = relationship(
        "ChangeLog", back_populates="workspace", cascade="all, delete-orphan"
    )
    tasks: Mapped[list["Task"]] = relationship(
        "Task", back_populates="workspace", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Workspace(id={self.id}, name={self.name!r}, path={self.path!r})>"
