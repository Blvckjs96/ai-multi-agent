"""Sprint G: add user_provider_configs table for user-defined LLM providers.

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-20
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: str = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_provider_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("provider_type", sa.String(30), nullable=False),
        sa.Column("host_url", sa.Text, nullable=True),
        sa.Column("api_key", sa.Text, nullable=True),
        sa.Column("model_name", sa.String(200), nullable=True),
        sa.Column("is_enabled", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("is_default", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("extra_config", postgresql.JSONB, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_user_provider_configs_provider_type", "user_provider_configs", ["provider_type"])
    op.create_index("ix_user_provider_configs_is_default", "user_provider_configs", ["is_default"])


def downgrade() -> None:
    op.drop_index("ix_user_provider_configs_is_default", table_name="user_provider_configs")
    op.drop_index("ix_user_provider_configs_provider_type", table_name="user_provider_configs")
    op.drop_table("user_provider_configs")
