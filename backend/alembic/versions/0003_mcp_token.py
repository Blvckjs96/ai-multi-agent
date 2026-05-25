"""Add mcp_token to users table for Chiron MCP authentication.

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-19
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("mcp_token", sa.String(255), nullable=True),
    )
    op.create_index("ix_users_mcp_token", "users", ["mcp_token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_mcp_token", table_name="users")
    op.drop_column("users", "mcp_token")
