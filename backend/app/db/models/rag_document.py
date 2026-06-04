"""RAG document model — stores chunked knowledge for retrieval-augmented generation."""

import uuid

from sqlalchemy import Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class RagDocument(Base, TimestampMixin):
    """A chunked piece of text stored for full-text retrieval.

    Attributes:
        id: Unique identifier.
        source_type: Origin category — 'manual', 'url', 'github', 'text'.
        source_ref: Identifier of the originating sync source (UUID string or URL).
        title: Human-readable label for the chunk.
        content: The text content of this chunk (~1500 chars / ~375 tokens).
        chunk_index: Position of this chunk within its original document.
        token_count: Approximate token count (len(content) // 4).
        extra: Arbitrary key-value pairs for filtering and display.
    """

    __tablename__ = "rag_documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    source_ref: Mapped[str | None] = mapped_column(String(512), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    extra: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")

    def __repr__(self) -> str:
        return f"<RagDocument(id={self.id}, title={self.title!r}, chunk={self.chunk_index})>"
