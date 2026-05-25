"""RAG document service — text chunking, storage, and retrieval."""

import logging
import re
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import rag_document as rag_repo

logger = logging.getLogger(__name__)

_CHUNK_TARGET = 1500  # target chars per chunk (~375 tokens)
_CHUNK_OVERLAP = 150  # overlap to preserve cross-chunk context


def _split_into_chunks(
    text: str,
    chunk_size: int = _CHUNK_TARGET,
    overlap: int = _CHUNK_OVERLAP,
) -> list[str]:
    """Split text into overlapping chunks, respecting paragraph boundaries.

    Strategy:
      1. Split on blank lines (paragraphs).
      2. Merge small paragraphs into chunks up to chunk_size.
      3. Hard-split paragraphs that exceed chunk_size, with overlap.
    """
    paragraphs = re.split(r"\n\s*\n", text.strip())
    paragraphs = [p.strip() for p in paragraphs if p.strip()]

    chunks: list[str] = []
    current = ""

    for para in paragraphs:
        candidate = f"{current}\n\n{para}" if current else para
        if len(candidate) <= chunk_size:
            current = candidate
        else:
            if current:
                chunks.append(current)
            if len(para) > chunk_size:
                for i in range(0, len(para), chunk_size - overlap):
                    segment = para[i : i + chunk_size]
                    if segment.strip():
                        chunks.append(segment)
                current = ""
            else:
                current = para

    if current:
        chunks.append(current)

    return chunks


async def chunk_and_store(
    db: AsyncSession,
    *,
    text: str,
    title: str,
    source_type: str,
    source_ref: str | None = None,
    extra: dict[str, Any] | None = None,
) -> int:
    """Chunk text and persist all chunks. Returns number of chunks created.

    If source_ref is provided, existing chunks for that reference are
    deleted first to avoid duplicates on re-sync.
    """
    if not text.strip():
        return 0

    if source_ref:
        deleted = await rag_repo.delete_by_source_ref(db, source_ref)
        if deleted:
            logger.debug("Purged %d stale chunks for source_ref=%r", deleted, source_ref)

    chunks = _split_into_chunks(text)
    for idx, chunk in enumerate(chunks):
        await rag_repo.create_chunk(
            db,
            source_type=source_type,
            title=f"{title} [{idx + 1}/{len(chunks)}]",
            content=chunk,
            chunk_index=idx,
            source_ref=source_ref,
            extra=extra or {},
        )

    logger.info("Stored %d chunks: title=%r source_type=%s", len(chunks), title, source_type)
    return len(chunks)


async def retrieve_context(db: AsyncSession, query: str, *, limit: int = 5) -> str:
    """Retrieve relevant chunks and return a formatted context block.

    The returned string is designed to be prepended to the pipeline description
    so every agent has access to the retrieved knowledge.

    Returns empty string when the RAG corpus is empty or no matches found.
    """
    docs = await rag_repo.search_by_text(db, query, limit=limit)
    if not docs:
        return ""

    parts = ["=== RETRIEVED KNOWLEDGE CONTEXT ==="]
    for doc in docs:
        source_label = doc.source_ref or doc.source_type
        parts.append(f"\n--- {doc.title} (source: {source_label}) ---")
        parts.append(doc.content)
    parts.append("\n=== END CONTEXT ===\n")

    return "\n".join(parts)
