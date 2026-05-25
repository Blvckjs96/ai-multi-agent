"""Chiron knowledge engine models."""

import uuid
from enum import StrEnum
from typing import TYPE_CHECKING, Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.workspace import Workspace


class SourceStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    DONE = "done"
    ERROR = "error"


class ChironSource(Base, TimestampMixin):
    """A raw source file ingested into the Chiron knowledge base."""

    __tablename__ = "chiron_sources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    raw_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False, default="text/plain")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=SourceStatus.PENDING)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    minio_key: Mapped[str | None] = mapped_column(Text, nullable=True)

    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="sources")
    wiki_pages: Mapped[list["ChironWikiPage"]] = relationship(
        "ChironWikiPage", secondary="chiron_page_sources", back_populates="sources"
    )
    plans: Mapped[list["ChironCompilationPlan"]] = relationship(
        "ChironCompilationPlan", back_populates="source", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<ChironSource(id={self.id}, path={self.file_path!r}, status={self.status!r})>"


class ChironWikiPage(Base, TimestampMixin):
    """A wiki page generated from one or more sources."""

    __tablename__ = "chiron_wiki_pages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    keyword_vector: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    tags: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    revision: Mapped[int] = mapped_column(default=1, nullable=False)

    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="wiki_pages")
    sources: Mapped[list["ChironSource"]] = relationship(
        "ChironSource", secondary="chiron_page_sources", back_populates="wiki_pages"
    )
    links_from: Mapped[list["ChironWikiLink"]] = relationship(
        "ChironWikiLink",
        foreign_keys="ChironWikiLink.from_page_id",
        back_populates="from_page",
        cascade="all, delete-orphan",
    )
    links_to: Mapped[list["ChironWikiLink"]] = relationship(
        "ChironWikiLink",
        foreign_keys="ChironWikiLink.to_page_id",
        back_populates="to_page",
        cascade="all, delete-orphan",
    )
    embeddings: Mapped[list["ChironPageEmbedding"]] = relationship(
        "ChironPageEmbedding", back_populates="page", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<ChironWikiPage(id={self.id}, title={self.title!r})>"


class ChironPageSource(Base):
    """Association table: wiki pages ↔ source files."""

    __tablename__ = "chiron_page_sources"

    page_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chiron_wiki_pages.id", ondelete="CASCADE"), primary_key=True
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chiron_sources.id", ondelete="CASCADE"), primary_key=True
    )


class ChironWikiLink(Base, TimestampMixin):
    """Directed link between two wiki pages (wikilinks)."""

    __tablename__ = "chiron_wiki_links"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    from_page_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chiron_wiki_pages.id", ondelete="CASCADE"), nullable=False
    )
    to_page_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chiron_wiki_pages.id", ondelete="CASCADE"), nullable=False
    )
    anchor_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    from_page: Mapped["ChironWikiPage"] = relationship(
        "ChironWikiPage", foreign_keys=[from_page_id], back_populates="links_from"
    )
    to_page: Mapped["ChironWikiPage"] = relationship(
        "ChironWikiPage", foreign_keys=[to_page_id], back_populates="links_to"
    )


# ---------------------------------------------------------------------------
# Sprint C — MRP pipeline tables
# ---------------------------------------------------------------------------


class MRPPhase(StrEnum):
    TRIAGE = "triage"
    MAP = "map"
    REDUCE = "reduce"
    REFINE = "refine"
    VERIFY = "verify"
    COMMIT = "commit"


class PlanStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    WAITING_REVIEW = "waiting_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    DONE = "done"
    ERROR = "error"


class DraftStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ChironCompilationPlan(Base, TimestampMixin):
    """One MRP compilation run for a single source document.

    Tracks which phase is active, stores phase outputs as JSONB, and holds the
    proposed wiki page list that the human reviews before COMMIT.
    """

    __tablename__ = "chiron_compilation_plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chiron_sources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    phase: Mapped[str] = mapped_column(String(20), nullable=False, default=MRPPhase.TRIAGE)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=PlanStatus.PENDING)
    phase_results: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    proposed_pages: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    arq_job_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    source: Mapped["ChironSource"] = relationship("ChironSource", back_populates="plans")

    def __repr__(self) -> str:
        return f"<ChironCompilationPlan(id={self.id}, phase={self.phase}, status={self.status})>"


class ChironChunkExtract(Base, TimestampMixin):
    """A semantic chunk extracted from a source during the MAP phase."""

    __tablename__ = "chiron_chunk_extracts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chiron_compilation_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chiron_sources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    entities: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<ChironChunkExtract(id={self.id}, index={self.chunk_index}, title={self.title!r})>"


class ChironWikiDraft(Base, TimestampMixin):
    """A proposed edit to a wiki page — created by Claude (propose_wiki_edit) or VERIFY phase."""

    __tablename__ = "chiron_wiki_drafts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    page_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chiron_wiki_pages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    plan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chiron_compilation_plans.id", ondelete="SET NULL"),
        nullable=True,
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=DraftStatus.PENDING)
    reviewer_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    page: Mapped["ChironWikiPage | None"] = relationship("ChironWikiPage")

    def __repr__(self) -> str:
        return f"<ChironWikiDraft(id={self.id}, title={self.title!r}, status={self.status})>"


class ChironWikiRevision(Base, TimestampMixin):
    """Immutable snapshot of a wiki page at a given revision."""

    __tablename__ = "chiron_wiki_revisions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    page_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chiron_wiki_pages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    changed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)

    __table_args__ = (UniqueConstraint("page_id", "revision", name="uq_chiron_revision_page_rev"),)

    def __repr__(self) -> str:
        return f"<ChironWikiRevision(page={self.page_id}, rev={self.revision})>"


class ChironKnowledgeType(Base, TimestampMixin):
    """Taxonomy of document types used by the TRIAGE phase."""

    __tablename__ = "chiron_knowledge_types"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)

    def __repr__(self) -> str:
        return f"<ChironKnowledgeType(name={self.name!r})>"


class ChironConfig(Base, TimestampMixin):
    """Key-value config for Chiron (workspace-scoped or global if workspace_id is NULL)."""

    __tablename__ = "chiron_config"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    key: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[dict | list | str | None] = mapped_column(JSONB, nullable=True)

    __table_args__ = (UniqueConstraint("workspace_id", "key", name="uq_chiron_config_ws_key"),)

    def __repr__(self) -> str:
        return f"<ChironConfig(key={self.key!r}, workspace={self.workspace_id})>"


# ---------------------------------------------------------------------------
# Sprint D — pgvector semantic embeddings
# ---------------------------------------------------------------------------


class ChironPageEmbedding(Base, TimestampMixin):
    """Semantic embedding for a wiki page.

    One row per (page_id, model_id) pair. The content_hash guards against
    re-embedding unchanged pages.

    Supports 768-dimension Ollama models (default: nomic-embed-text).
    The HNSW index is built at migration time.
    """

    __tablename__ = "chiron_page_embeddings"

    page_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chiron_wiki_pages.id", ondelete="CASCADE"),
        primary_key=True,
    )
    model_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    embedding: Mapped[Any] = mapped_column(Vector(768), nullable=True)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)

    page: Mapped["ChironWikiPage"] = relationship("ChironWikiPage", back_populates="embeddings")

    def __repr__(self) -> str:
        return f"<ChironPageEmbedding(page={self.page_id}, model={self.model_id!r})>"
