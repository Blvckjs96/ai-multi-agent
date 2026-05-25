"""Task board model — Kanban tasks per workspace."""

import uuid
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.task_session import TaskSession
    from app.db.models.workspace import Workspace


class TaskStatus(StrEnum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    DONE = "done"


class TaskStep(StrEnum):
    BACKLOG = "backlog"
    PLANNING = "planning"
    IMPLEMENTATION = "implementation"
    REVIEW = "review"
    DONE = "done"
    MISC = "misc"


class TaskPriority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class WorktreeStrategy(StrEnum):
    CREATE = "create"
    EXISTING = "existing"
    NONE = "none"


class Task(Base, TimestampMixin):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=TaskStatus.TODO)
    priority: Mapped[str] = mapped_column(String(10), nullable=False, default=TaskPriority.MEDIUM)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    assignee: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Extended Argo fields
    step: Mapped[str] = mapped_column(String(20), nullable=False, default=TaskStep.BACKLOG)
    cwd: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    worktree_strategy: Mapped[str | None] = mapped_column(String(20), nullable=True)
    worktree_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    worktree_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    base_branch: Mapped[str | None] = mapped_column(String(255), nullable=True)
    external_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    external_key: Mapped[str | None] = mapped_column(String(100), nullable=True)
    external_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    sort_order: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="tasks")
    task_sessions: Mapped[list["TaskSession"]] = relationship(
        "TaskSession", back_populates="task", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Task(id={self.id}, title={self.title!r}, step={self.step!r})>"
