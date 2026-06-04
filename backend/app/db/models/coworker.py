"""AI Coworker personas — named agents with role-specific system prompts."""

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Coworker(Base, TimestampMixin):
    """A named AI persona bound to a user.

    Each coworker has a role and a system_prompt that is prepended to the
    Claude session via --append-system-prompt, shaping the agent's behaviour
    from the first message without the user having to set context manually.
    """

    __tablename__ = "coworkers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # "claude" | "sonnet" | "haiku" | "opus" — model tier override
    model: Mapped[str] = mapped_column(String(50), nullable=False, default="sonnet")

    # Attached KB source IDs, tool IDs, and skill IDs (stored as JSON arrays of UUID strings)
    knowledge_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    tool_ids:      Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    skill_ids:     Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    def __repr__(self) -> str:
        return f"<Coworker(id={self.id}, name={self.name!r}, role={self.role!r})>"
