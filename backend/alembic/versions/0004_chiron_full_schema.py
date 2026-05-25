"""Chiron full schema — MRP pipeline tables (compilation_plans, chunks, drafts, revisions, taxonomy, config).

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-19
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # chiron_compilation_plans
    op.create_table(
        "chiron_compilation_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "source_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("chiron_sources.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "workspace_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("phase", sa.String(20), nullable=False, server_default="triage"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("phase_results", postgresql.JSONB, nullable=True),
        sa.Column("proposed_pages", postgresql.JSONB, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("arq_job_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now(), nullable=True),
    )
    op.create_index("ix_chiron_compilation_plans_source_id", "chiron_compilation_plans", ["source_id"])
    op.create_index("ix_chiron_compilation_plans_workspace_id", "chiron_compilation_plans", ["workspace_id"])

    # chiron_chunk_extracts
    op.create_table(
        "chiron_chunk_extracts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "plan_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("chiron_compilation_plans.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "source_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("chiron_sources.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("chunk_index", sa.Integer, nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("entities", postgresql.JSONB, nullable=True),
        sa.Column("summary", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now(), nullable=True),
    )
    op.create_index("ix_chiron_chunk_extracts_plan_id", "chiron_chunk_extracts", ["plan_id"])
    op.create_index("ix_chiron_chunk_extracts_source_id", "chiron_chunk_extracts", ["source_id"])

    # chiron_wiki_drafts
    op.create_table(
        "chiron_wiki_drafts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "workspace_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "page_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("chiron_wiki_pages.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "plan_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("chiron_compilation_plans.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("rationale", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("reviewer_note", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now(), nullable=True),
    )
    op.create_index("ix_chiron_wiki_drafts_workspace_id", "chiron_wiki_drafts", ["workspace_id"])
    op.create_index("ix_chiron_wiki_drafts_page_id", "chiron_wiki_drafts", ["page_id"])

    # chiron_wiki_revisions
    op.create_table(
        "chiron_wiki_revisions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "page_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("chiron_wiki_pages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("revision", sa.Integer, nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("changed_by", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now(), nullable=True),
    )
    op.create_index("ix_chiron_wiki_revisions_page_id", "chiron_wiki_revisions", ["page_id"])
    op.create_unique_constraint(
        "uq_chiron_revision_page_rev", "chiron_wiki_revisions", ["page_id", "revision"]
    )

    # chiron_knowledge_types
    op.create_table(
        "chiron_knowledge_types",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "workspace_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now(), nullable=True),
    )
    op.create_index("ix_chiron_knowledge_types_workspace_id", "chiron_knowledge_types", ["workspace_id"])

    # chiron_config
    op.create_table(
        "chiron_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "workspace_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("key", sa.String(255), nullable=False),
        sa.Column("value", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now(), nullable=True),
    )
    op.create_index("ix_chiron_config_workspace_id", "chiron_config", ["workspace_id"])
    op.create_unique_constraint("uq_chiron_config_ws_key", "chiron_config", ["workspace_id", "key"])


def downgrade() -> None:
    op.drop_table("chiron_config")
    op.drop_table("chiron_knowledge_types")
    op.drop_table("chiron_wiki_revisions")
    op.drop_table("chiron_wiki_drafts")
    op.drop_table("chiron_chunk_extracts")
    op.drop_table("chiron_compilation_plans")
