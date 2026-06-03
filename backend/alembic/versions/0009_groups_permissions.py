"""groups table and user profile fields

Revision ID: 0009
Revises: 0008
Create Date: 2026-06-03

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Groups table
    op.create_table(
        "groups",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("member_ids", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("permissions", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id", name="groups_pkey"),
        sa.UniqueConstraint("name", name="groups_name_key"),
    )

    # User: api_key, bio, profile_image_url, pending role support
    op.add_column("users", sa.Column("api_key", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("bio", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("profile_image_url", sa.Text(), nullable=True))
    op.create_unique_constraint("users_api_key_key", "users", ["api_key"])
    op.create_index("ix_users_api_key", "users", ["api_key"])


def downgrade() -> None:
    op.drop_index("ix_users_api_key", table_name="users")
    op.drop_constraint("users_api_key_key", "users", type_="unique")
    op.drop_column("users", "profile_image_url")
    op.drop_column("users", "bio")
    op.drop_column("users", "api_key")
    op.drop_table("groups")
