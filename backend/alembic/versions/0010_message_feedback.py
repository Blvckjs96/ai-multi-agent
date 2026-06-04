"""message_feedback table

Revision ID: 0010
Revises: 0009
Create Date: 2026-06-03
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "message_feedback",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("conversation_id", sa.String(36), nullable=False),
        sa.Column("message_id", sa.String(36), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("rating", sa.String(10), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="message_feedback_pkey"),
    )
    op.create_index(
        "ix_message_feedback_conversation_id",
        "message_feedback",
        ["conversation_id"],
    )
    op.create_index(
        "ix_message_feedback_message_id",
        "message_feedback",
        ["message_id"],
    )
    op.create_index(
        "ix_message_feedback_user_id",
        "message_feedback",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_table("message_feedback")
