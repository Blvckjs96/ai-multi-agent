"""Change log model — tracks every Claude CLI action per workspace."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.workspace import Workspace


class ChangeLog(Base, TimestampMixin):
    """One entry = one Claude CLI session that made file changes."""

    __tablename__ = "change_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    session_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    git_commit_hash: Mapped[str | None] = mapped_column(String(40), nullable=True)
    diff: Mapped[str | None] = mapped_column(Text, nullable=True)
    files_changed: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )  # pending | committed | reverted

    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="change_logs")

    def __repr__(self) -> str:
        return f"<ChangeLog(id={self.id}, status={self.status!r}, commit={self.git_commit_hash!r})>"
