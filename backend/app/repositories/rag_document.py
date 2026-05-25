"""RAG document repository — data access for chunked knowledge."""

import uuid
from typing import Any

from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.rag_document import RagDocument


async def create_chunk(
    db: AsyncSession,
    *,
    source_type: str,
    title: str,
    content: str,
    chunk_index: int = 0,
    source_ref: str | None = None,
    extra: dict[str, Any] | None = None,
) -> RagDocument:
    """Persist a single text chunk. Caller must not commit — session auto-commits."""
    doc = RagDocument(
        source_type=source_type,
        source_ref=source_ref,
        title=title,
        content=content,
        chunk_index=chunk_index,
        token_count=max(1, len(content) // 4),
        extra=extra or {},
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)
    return doc


async def delete_by_source_ref(db: AsyncSession, source_ref: str) -> int:
    """Delete all chunks for a given source reference. Returns deleted count."""
    result = await db.execute(delete(RagDocument).where(RagDocument.source_ref == source_ref))
    await db.flush()
    return result.rowcount  # type: ignore[return-value]


async def search_by_text(
    db: AsyncSession,
    query: str,
    *,
    limit: int = 5,
) -> list[RagDocument]:
    """Full-text search using PostgreSQL tsvector ranking.

    Falls back to ILIKE substring match if no FTS results are found.
    """
    fts_stmt = (
        select(RagDocument)
        .where(text("to_tsvector('english', content) @@ plainto_tsquery('english', :q)"))
        .order_by(
            text("ts_rank(to_tsvector('english', content), plainto_tsquery('english', :q)) DESC")
        )
        .limit(limit)
        .params(q=query)
    )
    result = await db.execute(fts_stmt)
    docs = list(result.scalars().all())

    if docs:
        return docs

    # Fallback: simple ILIKE on the first meaningful word
    first_word = query.split()[0] if query.split() else query
    fallback_stmt = (
        select(RagDocument).where(RagDocument.content.ilike(f"%{first_word}%")).limit(limit)
    )
    result = await db.execute(fallback_stmt)
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, doc_id: uuid.UUID) -> RagDocument | None:
    result = await db.execute(select(RagDocument).where(RagDocument.id == doc_id))
    return result.scalar_one_or_none()


async def count_all(db: AsyncSession) -> int:
    """Return total number of stored chunks."""
    result = await db.execute(select(func.count()).select_from(RagDocument))
    return result.scalar_one()


async def list_source_refs(db: AsyncSession) -> list[str]:
    """Return distinct source_refs that have chunks stored."""
    result = await db.execute(
        select(RagDocument.source_ref).distinct().where(RagDocument.source_ref.isnot(None))
    )
    return [r for r in result.scalars().all() if r]
