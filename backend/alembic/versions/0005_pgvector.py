"""Sprint D/E: enable pgvector extension and create chiron_page_embeddings table.

Uses 768-dimensional vectors (Ollama nomic-embed-text).

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-19
"""

from __future__ import annotations

from alembic import op

revision: str = "0005"
down_revision: str = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgvector — safe if already installed
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Embeddings table — raw SQL because Alembic's type system doesn't know vector(768)
    op.execute("""
        CREATE TABLE chiron_page_embeddings (
            page_id     UUID        NOT NULL
                        REFERENCES  chiron_wiki_pages(id) ON DELETE CASCADE,
            model_id    VARCHAR(100) NOT NULL,
            embedding   vector(768),
            content_hash VARCHAR(64) NOT NULL,
            created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ,
            PRIMARY KEY (page_id, model_id)
        )
    """)

    # HNSW index for approximate cosine nearest-neighbour search
    op.execute("""
        CREATE INDEX chiron_embeddings_hnsw_idx
        ON chiron_page_embeddings
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS chiron_page_embeddings")
    op.execute("DROP EXTENSION IF EXISTS vector")
