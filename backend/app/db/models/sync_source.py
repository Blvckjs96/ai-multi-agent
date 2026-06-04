"""Sync source model — tracks external data sources for RAG auto-fetch."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class SyncSource(Base, TimestampMixin):
    """An external data source that is periodically fetched and stored in RAG.

    Attributes:
        id: Unique identifier.
        name: Human-readable label, e.g. 'Company Docs' or 'GitHub README'.
        source_type: Category — 'url', 'github', 'text'.
        config: Provider-specific settings:
            url → {"url": "https://..."}
            github → {"owner": "...", "repo": "...", "branch": "main"}
            text → {"content": "raw text..."}
        is_active: Whether auto-fetch is enabled for this source.
        last_synced_at: Timestamp of the most recent successful sync.
    """

    __tablename__ = "sync_sources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<SyncSource(id={self.id}, name={self.name!r}, type={self.source_type})>"
