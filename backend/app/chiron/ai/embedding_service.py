"""Chiron semantic embedding service — Ollama backend.

Uses Ollama's local embedding API (POST /api/embeddings).
Default model: nomic-embed-text (768d, 274 MB, free and local).

Falls back gracefully — callers check `is_available` before calling.
When Ollama is unreachable, `embed()` returns None and ChironService
falls back to TF-IDF keyword search.
"""

from __future__ import annotations

import hashlib
import logging
import uuid
from typing import Any

from sqlalchemy import Float, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

logger = logging.getLogger(__name__)

_EMBEDDING_DIM = 768

# Runtime model override — set via ProviderRegistry.set_active_embedding_model().
# None means "use settings.CHIRON_EMBEDDING_MODEL".
_active_model_override: str | None = None


def set_active_model(model_id: str) -> None:
    """Override the active embedding model and reset the singleton."""
    global _active_model_override, _embedding_svc
    _active_model_override = model_id
    _embedding_svc = None  # force recreation on next get_embedding_service() call


def get_active_model_id() -> str:
    return _active_model_override or settings.CHIRON_EMBEDDING_MODEL


def _text_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


class EmbeddingService:
    """Ollama-backed embedding service with pgvector upsert/search."""

    def __init__(self) -> None:
        self._base_url = settings.OLLAMA_HOST.rstrip("/")
        self._model = get_active_model_id()

    @property
    def is_available(self) -> bool:
        return bool(self._base_url)

    async def embed(self, text: str) -> list[float] | None:
        import httpx

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{self._base_url}/api/embeddings",
                    json={"model": self._model, "prompt": text[:8191]},
                )
                resp.raise_for_status()
                return resp.json()["embedding"]
        except Exception:
            logger.exception("Ollama embedding request failed (model=%r)", self._model)
            return None

    async def upsert_page(
        self,
        db: AsyncSession,
        page_id: uuid.UUID,
        title: str,
        content: str,
    ) -> bool:
        """Compute and store/update the embedding for a wiki page.

        Returns True if the embedding was written, False if skipped (same hash
        or Ollama unreachable).
        """
        from app.db.models.chiron import ChironPageEmbedding

        text = f"{title}\n\n{content}"
        content_hash = _text_hash(text)
        model_id = self._model

        result = await db.execute(
            select(ChironPageEmbedding.content_hash).where(
                ChironPageEmbedding.page_id == page_id,
                ChironPageEmbedding.model_id == model_id,
            )
        )
        existing_hash = result.scalar_one_or_none()
        if existing_hash == content_hash:
            return False

        embedding = await self.embed(text)
        if embedding is None:
            return False

        existing: Any = (
            await db.execute(
                select(ChironPageEmbedding).where(
                    ChironPageEmbedding.page_id == page_id,
                    ChironPageEmbedding.model_id == model_id,
                )
            )
        ).scalar_one_or_none()

        if existing:
            existing.embedding = embedding
            existing.content_hash = content_hash
        else:
            db.add(
                ChironPageEmbedding(
                    page_id=page_id,
                    model_id=model_id,
                    embedding=embedding,
                    content_hash=content_hash,
                )
            )
        await db.flush()
        return True

    async def search(
        self,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        query: str,
        top_k: int = 5,
        max_distance: float = 0.8,
    ) -> list[dict] | None:
        """Return top-K wiki pages by cosine similarity.

        Returns None when Ollama is unreachable (caller falls back to TF-IDF).
        """
        from app.db.models.chiron import ChironPageEmbedding, ChironWikiPage

        query_vec = await self.embed(query)
        if query_vec is None:
            return None

        model_id = self._model

        # <=> is the pgvector cosine distance operator (0 = identical, 2 = opposite)
        dist_col = ChironPageEmbedding.embedding.op("<=>", return_type=Float)(query_vec)

        stmt = (
            select(
                ChironWikiPage.id,
                ChironWikiPage.title,
                ChironWikiPage.summary,
                dist_col.label("dist"),
            )
            .join(ChironPageEmbedding, ChironPageEmbedding.page_id == ChironWikiPage.id)
            .where(
                ChironWikiPage.workspace_id == workspace_id,
                ChironPageEmbedding.model_id == model_id,
                dist_col <= max_distance,
            )
            .order_by(dist_col)
            .limit(top_k)
        )

        rows = (await db.execute(stmt)).all()
        if not rows:
            return []

        return [
            {
                "id": str(r[0]),
                "title": r[1],
                "summary": r[2],
                "score": round(1 - r[3], 4),
                "workspace_id": str(workspace_id),
            }
            for r in rows
        ]


# Module-level singleton — created once per process
_embedding_svc: EmbeddingService | None = None


def get_embedding_service() -> EmbeddingService:
    global _embedding_svc
    if _embedding_svc is None:
        _embedding_svc = EmbeddingService()
    return _embedding_svc
