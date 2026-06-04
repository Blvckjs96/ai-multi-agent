"""coworker attachment columns (knowledge_ids, tool_ids, skill_ids)

Revision ID: 0014
Revises: 0013
Create Date: 2026-06-04
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("coworkers", sa.Column("knowledge_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"))
    op.add_column("coworkers", sa.Column("tool_ids",      postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"))
    op.add_column("coworkers", sa.Column("skill_ids",     postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"))


def downgrade() -> None:
    op.drop_column("coworkers", "skill_ids")
    op.drop_column("coworkers", "tool_ids")
    op.drop_column("coworkers", "knowledge_ids")
