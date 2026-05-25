"""task_session and extended task fields

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-22

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add extended fields to tasks table
    op.add_column("tasks", sa.Column("step", sa.String(20), nullable=False, server_default="backlog"))
    op.add_column("tasks", sa.Column("cwd", sa.String(1000), nullable=True))
    op.add_column("tasks", sa.Column("worktree_strategy", sa.String(20), nullable=True))
    op.add_column("tasks", sa.Column("worktree_path", sa.String(1000), nullable=True))
    op.add_column("tasks", sa.Column("worktree_name", sa.String(255), nullable=True))
    op.add_column("tasks", sa.Column("base_branch", sa.String(255), nullable=True))
    op.add_column("tasks", sa.Column("external_provider", sa.String(50), nullable=True))
    op.add_column("tasks", sa.Column("external_id", sa.String(255), nullable=True))
    op.add_column("tasks", sa.Column("external_key", sa.String(100), nullable=True))
    op.add_column("tasks", sa.Column("external_url", sa.String(2000), nullable=True))
    op.add_column("tasks", sa.Column("sort_order", sa.Float(), nullable=False, server_default="0.0"))

    # Create task_sessions table
    op.create_table(
        "task_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "workspace_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("shell", sa.String(50), nullable=False, server_default="zsh"),
        sa.Column("cli", sa.String(50), nullable=False, server_default="claude"),
        sa.Column("runtime_status", sa.String(30), nullable=False, server_default="none"),
        sa.Column("pid", sa.Integer(), nullable=True),
        sa.Column("exit_code", sa.Integer(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("stopped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("claude_session_id", sa.String(255), nullable=True),
        sa.Column("plan_mode", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now(), nullable=True),
    )
    op.create_index("ix_task_sessions_task_id", "task_sessions", ["task_id"])
    op.create_index("ix_task_sessions_workspace_id", "task_sessions", ["workspace_id"])


def downgrade() -> None:
    op.drop_table("task_sessions")
    op.drop_column("tasks", "sort_order")
    op.drop_column("tasks", "external_url")
    op.drop_column("tasks", "external_key")
    op.drop_column("tasks", "external_id")
    op.drop_column("tasks", "external_provider")
    op.drop_column("tasks", "base_branch")
    op.drop_column("tasks", "worktree_name")
    op.drop_column("tasks", "worktree_path")
    op.drop_column("tasks", "worktree_strategy")
    op.drop_column("tasks", "cwd")
    op.drop_column("tasks", "step")
