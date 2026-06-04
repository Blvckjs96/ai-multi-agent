"""Per-task Claude CLI / shell session."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.task import Task
    from app.db.models.workspace import Workspace


class SessionStatus(str):
    NONE = "none"
    STARTING = "starting"
    BUSY = "busy"
    AWAITING_INPUT = "awaiting_input"
    STOPPED = "stopped"


class TaskSession(Base, TimestampMixin):
    __tablename__ = "task_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    shell: Mapped[str] = mapped_column(String(50), nullable=False, default="zsh")
    cli: Mapped[str] = mapped_column(String(50), nullable=False, default="claude")
    runtime_status: Mapped[str] = mapped_column(String(30), nullable=False, default="none")
    pid: Mapped[int | None] = mapped_column(Integer, nullable=True)
    exit_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    stopped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    claude_session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    plan_mode: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    task: Mapped["Task"] = relationship("Task", back_populates="task_sessions")
    workspace: Mapped["Workspace"] = relationship("Workspace")

    def __repr__(self) -> str:
        return f"<TaskSession(id={self.id}, task_id={self.task_id}, status={self.runtime_status!r})>"
