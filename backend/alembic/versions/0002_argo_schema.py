"""Argo schema — workspaces, Chiron knowledge engine, change log, task board.

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-16
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── workspaces ────────────────────────────────────────────────────────────
    op.create_table(
        "workspaces",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("path", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="workspaces_pkey"),
        sa.UniqueConstraint("path", name="workspaces_path_key"),
    )

    # ── chiron_sources ────────────────────────────────────────────────────────
    op.create_table(
        "chiron_sources",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("raw_content", sa.Text(), nullable=True),
        sa.Column("mime_type", sa.String(100), nullable=False, server_default="text/plain"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("minio_key", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE",
                                name="chiron_sources_workspace_id_fkey"),
        sa.PrimaryKeyConstraint("id", name="chiron_sources_pkey"),
    )
    op.create_index("chiron_sources_workspace_id_idx", "chiron_sources", ["workspace_id"])

    # ── chiron_wiki_pages ─────────────────────────────────────────────────────
    op.create_table(
        "chiron_wiki_pages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("keyword_vector", postgresql.JSONB(), nullable=True),
        sa.Column("tags", postgresql.JSONB(), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE",
                                name="chiron_wiki_pages_workspace_id_fkey"),
        sa.PrimaryKeyConstraint("id", name="chiron_wiki_pages_pkey"),
    )
    op.create_index("chiron_wiki_pages_workspace_id_idx", "chiron_wiki_pages", ["workspace_id"])
    op.create_index("chiron_wiki_pages_title_idx", "chiron_wiki_pages", ["title"])

    # ── chiron_page_sources ───────────────────────────────────────────────────
    op.create_table(
        "chiron_page_sources",
        sa.Column("page_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["page_id"], ["chiron_wiki_pages.id"], ondelete="CASCADE",
                                name="chiron_page_sources_page_id_fkey"),
        sa.ForeignKeyConstraint(["source_id"], ["chiron_sources.id"], ondelete="CASCADE",
                                name="chiron_page_sources_source_id_fkey"),
        sa.PrimaryKeyConstraint("page_id", "source_id", name="chiron_page_sources_pkey"),
    )

    # ── chiron_wiki_links ─────────────────────────────────────────────────────
    op.create_table(
        "chiron_wiki_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("from_page_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("to_page_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("anchor_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["from_page_id"], ["chiron_wiki_pages.id"], ondelete="CASCADE",
                                name="chiron_wiki_links_from_page_id_fkey"),
        sa.ForeignKeyConstraint(["to_page_id"], ["chiron_wiki_pages.id"], ondelete="CASCADE",
                                name="chiron_wiki_links_to_page_id_fkey"),
        sa.PrimaryKeyConstraint("id", name="chiron_wiki_links_pkey"),
    )

    # ── change_logs ───────────────────────────────────────────────────────────
    op.create_table(
        "change_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", sa.String(255), nullable=True),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("git_commit_hash", sa.String(40), nullable=True),
        sa.Column("diff", sa.Text(), nullable=True),
        sa.Column("files_changed", postgresql.JSONB(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE",
                                name="change_logs_workspace_id_fkey"),
        sa.PrimaryKeyConstraint("id", name="change_logs_pkey"),
    )
    op.create_index("change_logs_workspace_id_idx", "change_logs", ["workspace_id"])
    op.create_index("change_logs_session_id_idx", "change_logs", ["session_id"])

    # ── tasks ─────────────────────────────────────────────────────────────────
    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="todo"),
        sa.Column("priority", sa.String(10), nullable=False, server_default="medium"),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("session_id", sa.String(255), nullable=True),
        sa.Column("assignee", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE",
                                name="tasks_workspace_id_fkey"),
        sa.PrimaryKeyConstraint("id", name="tasks_pkey"),
    )
    op.create_index("tasks_workspace_id_idx", "tasks", ["workspace_id"])


def downgrade() -> None:
    op.drop_table("tasks")
    op.drop_table("change_logs")
    op.drop_table("chiron_wiki_links")
    op.drop_table("chiron_page_sources")
    op.drop_table("chiron_wiki_pages")
    op.drop_table("chiron_sources")
    op.drop_table("workspaces")
