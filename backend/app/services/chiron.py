"""Chiron Knowledge Engine service.

MRP Pipeline:
  TRIAGE  → classify doc type
  MAP     → extract semantic chunks
  REDUCE  → synthesise into wiki page proposals
  REFINE  → polish for wiki quality
  VERIFY  → human review gate (creates ChironWikiDraft records)
  COMMIT  → apply approved pages to ChironWikiPage

Background processing runs via arq (see app/worker/arq_worker.py).
Search uses bag-of-words TF-IDF cosine similarity — no external ML required.
"""

from __future__ import annotations

import hashlib
import logging
import math
import re
import uuid
from collections import Counter
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, NotFoundError
from app.db.models.chiron import (
    ChironCompilationPlan,
    ChironSource,
    ChironWikiDraft,
    ChironWikiPage,
    DraftStatus,
    PlanStatus,
    SourceStatus,
)

logger = logging.getLogger(__name__)

# ── Text utilities ────────────────────────────────────────────────────────────

_STOP_WORDS: frozenset[str] = frozenset(
    {
        "a",
        "an",
        "the",
        "and",
        "or",
        "but",
        "in",
        "on",
        "at",
        "to",
        "for",
        "of",
        "with",
        "by",
        "from",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "has",
        "have",
        "had",
        "do",
        "does",
        "did",
        "will",
        "would",
        "could",
        "should",
        "may",
        "might",
        "it",
        "its",
        "this",
        "that",
        "these",
        "those",
        "i",
        "you",
        "he",
        "she",
        "we",
        "they",
        "not",
        "no",
        "if",
        "as",
    }
)


def _tokenize(text: str) -> list[str]:
    tokens = re.split(r"[^a-z0-9_]+", text.lower())
    return [t for t in tokens if len(t) > 2 and t not in _STOP_WORDS]


def _build_tfidf(text: str, all_texts: list[str]) -> dict[str, float]:
    """Build TF-IDF weights for text given a corpus of all_texts."""
    tokens = _tokenize(text)
    if not tokens:
        return {}
    tf = Counter(tokens)
    n = len(all_texts)

    result: dict[str, float] = {}
    for word, count in tf.items():
        df = sum(1 for t in all_texts if word in _tokenize(t))
        idf = math.log((n + 1) / (df + 1)) + 1
        result[word] = (count / len(tokens)) * idf

    # Normalise to unit vector
    norm = math.sqrt(sum(v * v for v in result.values())) or 1.0
    return {w: v / norm for w, v in result.items()}


def _cosine(vec_a: dict[str, float], vec_b: dict[str, float]) -> float:
    shared = set(vec_a) & set(vec_b)
    if not shared:
        return 0.0
    return sum(vec_a[w] * vec_b[w] for w in shared)


# ── ChironService ─────────────────────────────────────────────────────────────


class ChironService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Sources ──────────────────────────────────────────────────────────────

    async def ingest_source(
        self,
        workspace_id: uuid.UUID,
        file_path: str,
        content: str,
        mime_type: str = "text/plain",
        storage_key: str | None = None,
    ) -> ChironSource:
        """Ingest a raw source file. If unchanged (same hash), returns existing."""
        content_hash = hashlib.sha256(content.encode()).hexdigest()

        # Check for existing unchanged source
        result = await self.db.execute(
            select(ChironSource).where(
                ChironSource.workspace_id == workspace_id,
                ChironSource.file_path == file_path,
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            if existing.content_hash == content_hash:
                return existing
            existing.content_hash = content_hash
            existing.raw_content = content
            existing.status = SourceStatus.PENDING
            existing.error_message = None
            if storage_key:
                existing.minio_key = storage_key
            await self.db.flush()
            await self.db.refresh(existing)
            return existing

        source = ChironSource(
            workspace_id=workspace_id,
            file_path=file_path,
            content_hash=content_hash,
            raw_content=content,
            mime_type=mime_type,
            status=SourceStatus.PENDING,
            minio_key=storage_key,
        )
        self.db.add(source)
        await self.db.flush()
        await self.db.refresh(source)

        # Enqueue async MRP pipeline via arq
        await self._enqueue_mrp(source)
        return source

    async def _enqueue_mrp(self, source: ChironSource) -> None:
        """Enqueue ingest_mrp_task on the chiron arq queue."""
        try:
            from arq import create_pool
            from arq.connections import RedisSettings

            from app.core.config import settings

            redis = await create_pool(
                RedisSettings(
                    host=settings.REDIS_HOST,
                    port=settings.REDIS_PORT,
                    password=settings.REDIS_PASSWORD,
                    database=settings.REDIS_DB,
                ),
                default_queue_name="chiron",
            )
            job = await redis.enqueue_job(
                "ingest_mrp_task", str(source.id), str(source.workspace_id)
            )
            await redis.aclose()

            # Persist job id on the plan so it can be tracked
            if job:
                result = await self.db.execute(
                    select(ChironCompilationPlan).where(
                        ChironCompilationPlan.source_id == source.id,
                        ChironCompilationPlan.status == PlanStatus.PENDING,
                    )
                )
                plan = result.scalar_one_or_none()
                if plan:
                    plan.arq_job_id = job.job_id
                    await self.db.flush()
        except Exception:
            logger.exception("Chiron: failed to enqueue MRP task for source %s", source.id)

    async def _process_source(self, source: ChironSource) -> None:
        """MAP + COMMIT: extract concepts and create/update a wiki page."""
        source.status = SourceStatus.PROCESSING
        await self.db.flush()

        try:
            content = source.raw_content or ""
            title = self._extract_title(source.file_path, content)
            summary = self._extract_summary(content)

            # Fetch all existing page contents for IDF calculation
            result = await self.db.execute(
                select(ChironWikiPage.content).where(
                    ChironWikiPage.workspace_id == source.workspace_id
                )
            )
            corpus = [row[0] for row in result.fetchall()] + [content]
            keyword_vector = _build_tfidf(content, corpus)

            # Upsert wiki page by title + workspace
            pg_result = await self.db.execute(
                select(ChironWikiPage).where(
                    ChironWikiPage.workspace_id == source.workspace_id,
                    ChironWikiPage.title == title,
                )
            )
            page = pg_result.scalar_one_or_none()

            if page:
                page.content = content
                page.summary = summary
                page.keyword_vector = keyword_vector
                page.revision += 1
            else:
                page = ChironWikiPage(
                    workspace_id=source.workspace_id,
                    title=title,
                    content=content,
                    summary=summary,
                    keyword_vector=keyword_vector,
                )
                self.db.add(page)

            source.status = SourceStatus.DONE
            await self.db.flush()
            logger.info("Chiron: processed source %s → page %r", source.id, title)

        except Exception as exc:
            source.status = SourceStatus.ERROR
            source.error_message = str(exc)
            await self.db.flush()
            logger.exception("Chiron: failed to process source %s", source.id)

    @staticmethod
    def _extract_title(file_path: str, content: str) -> str:
        # Try first markdown heading
        for line in content.splitlines():
            line = line.strip()
            if line.startswith("# "):
                return line[2:].strip()[:200]
        # Fall back to filename without extension
        name = file_path.rsplit("/", 1)[-1]
        return name.rsplit(".", 1)[0].replace("_", " ").replace("-", " ").title()

    @staticmethod
    def _extract_summary(content: str, max_chars: int = 400) -> str:
        lines = [ln.strip() for ln in content.splitlines() if ln.strip() and not ln.startswith("#")]
        text = " ".join(lines)
        return text[:max_chars] + ("…" if len(text) > max_chars else "")

    # ── Search ───────────────────────────────────────────────────────────────

    async def hybrid_search(
        self,
        workspace_id: uuid.UUID,
        query: str,
        top_k: int = 8,
        alpha: float = 0.7,
    ) -> list[dict[str, Any]]:
        """Hybrid search: alpha * dense_score + (1-alpha) * bm25_score.

        Returns list of {source_id, source_name, chunk, score, page}.
        Falls back to TF-IDF when pgvector is unavailable.
        """
        from rank_bm25 import BM25Okapi

        dense_results = await self.search(workspace_id, query, top_k=top_k * 2)

        if not dense_results:
            return []

        corpus = [r.get("content", r.get("summary", "")) for r in dense_results]
        tokenized = [c.lower().split() for c in corpus]
        bm25 = BM25Okapi(tokenized)
        bm25_scores = bm25.get_scores(query.lower().split())

        max_dense = max((r.get("score", 0.0) for r in dense_results), default=1.0) or 1.0
        max_bm25 = max(bm25_scores, default=1.0) or 1.0

        combined = []
        for i, r in enumerate(dense_results):
            hybrid_score = (
                alpha * (r.get("score", 0.0) / max_dense)
                + (1 - alpha) * (float(bm25_scores[i]) / max_bm25)
            )
            combined.append(
                {
                    "source_id": r.get("id", ""),
                    "source_name": r.get("title", "Unknown"),
                    "chunk": corpus[i],
                    "score": round(hybrid_score, 4),
                    "page": None,
                }
            )

        combined.sort(key=lambda x: x["score"], reverse=True)
        combined = combined[:top_k]

        # Optional cross-encoder reranking (enabled via CHIRON_RERANK=true env var).
        import os

        if os.getenv("CHIRON_RERANK") == "true":
            try:
                from sentence_transformers import CrossEncoder

                model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
                pairs = [[query, r["chunk"]] for r in combined]
                rerank_scores = model.predict(pairs)
                for i, r in enumerate(combined):
                    r["score"] = float(rerank_scores[i])
                combined.sort(key=lambda x: x["score"], reverse=True)
            except ImportError:
                pass

        return combined

    async def search(
        self,
        workspace_id: uuid.UUID,
        query: str,
        top_k: int = 5,
        threshold: float = 0.05,
    ) -> list[dict[str, Any]]:
        """Semantic search: vector (pgvector) when available, TF-IDF fallback."""
        from app.chiron.ai.embedding_service import get_embedding_service

        svc = get_embedding_service()
        if svc.is_available:
            results = await svc.search(self.db, workspace_id, query, top_k=top_k)
            if results is not None:
                return results
            # results == None means embedding failed; fall through to TF-IDF

        return await self._tfidf_search(workspace_id, query, top_k, threshold)

    async def _tfidf_search(
        self,
        workspace_id: uuid.UUID,
        query: str,
        top_k: int,
        threshold: float,
    ) -> list[dict[str, Any]]:
        """TF-IDF bag-of-words fallback search."""
        result = await self.db.execute(
            select(ChironWikiPage).where(ChironWikiPage.workspace_id == workspace_id)
        )
        pages = result.scalars().all()
        if not pages:
            return []

        corpus = [p.content for p in pages]
        query_vec = _build_tfidf(query, [*corpus, query])

        scored = []
        for page in pages:
            vec = page.keyword_vector or {}
            score = _cosine(query_vec, vec)
            if score >= threshold:
                scored.append((score, page))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [
            {
                "id": str(p.id),
                "title": p.title,
                "summary": p.summary,
                "score": round(score, 4),
                "workspace_id": str(p.workspace_id),
            }
            for score, p in scored[:top_k]
        ]

    # ── Pages CRUD ────────────────────────────────────────────────────────────

    async def list_pages(self, workspace_id: uuid.UUID) -> list[ChironWikiPage]:
        result = await self.db.execute(
            select(ChironWikiPage)
            .where(ChironWikiPage.workspace_id == workspace_id)
            .order_by(ChironWikiPage.title)
        )
        return list(result.scalars().all())

    async def get_page(self, page_id: uuid.UUID) -> ChironWikiPage:
        result = await self.db.execute(select(ChironWikiPage).where(ChironWikiPage.id == page_id))
        page = result.scalar_one_or_none()
        if not page:
            raise NotFoundError(message="Wiki page not found", details={"page_id": str(page_id)})
        return page

    async def delete_page(self, page_id: uuid.UUID) -> None:
        page = await self.get_page(page_id)
        await self.db.delete(page)
        await self.db.flush()

    # ── Compilation Plans ─────────────────────────────────────────────────────

    async def list_plans(
        self,
        workspace_id: uuid.UUID,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[ChironCompilationPlan], int]:
        from sqlalchemy import func

        count_result = await self.db.execute(
            select(func.count()).where(ChironCompilationPlan.workspace_id == workspace_id)
        )
        total = count_result.scalar_one()
        result = await self.db.execute(
            select(ChironCompilationPlan)
            .where(ChironCompilationPlan.workspace_id == workspace_id)
            .order_by(ChironCompilationPlan.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all()), total

    async def get_plan(self, plan_id: uuid.UUID) -> ChironCompilationPlan:
        result = await self.db.execute(
            select(ChironCompilationPlan).where(ChironCompilationPlan.id == plan_id)
        )
        plan = result.scalar_one_or_none()
        if not plan:
            raise NotFoundError(
                message="Compilation plan not found", details={"plan_id": str(plan_id)}
            )
        return plan

    async def approve_plan(
        self, plan_id: uuid.UUID, workspace_id: uuid.UUID, changed_by: str | None = None
    ) -> dict[str, Any]:
        """Mark plan as APPROVED and enqueue the COMMIT arq task."""
        plan = await self.get_plan(plan_id)
        if plan.workspace_id != workspace_id:
            raise NotFoundError(
                message="Plan not found in this workspace", details={"plan_id": str(plan_id)}
            )
        if plan.status != PlanStatus.WAITING_REVIEW:
            raise BadRequestError(
                message=f"Plan is not waiting for review (current status: {plan.status})",
                details={"plan_id": str(plan_id), "status": plan.status},
            )
        plan.status = PlanStatus.APPROVED
        await self.db.flush()

        # Enqueue COMMIT task
        try:
            from arq import create_pool
            from arq.connections import RedisSettings

            from app.core.config import settings

            redis = await create_pool(
                RedisSettings(
                    host=settings.REDIS_HOST,
                    port=settings.REDIS_PORT,
                    password=settings.REDIS_PASSWORD,
                    database=settings.REDIS_DB,
                ),
                default_queue_name="chiron",
            )
            job = await redis.enqueue_job(
                "commit_plan_task", str(plan_id), str(workspace_id), changed_by
            )
            if job:
                plan.arq_job_id = job.job_id
                await self.db.flush()
            await redis.aclose()
        except Exception:
            logger.exception("Chiron: failed to enqueue commit task for plan %s", plan_id)

        return {"plan_id": str(plan_id), "status": "approved", "message": "COMMIT task enqueued."}

    async def reject_plan(
        self, plan_id: uuid.UUID, workspace_id: uuid.UUID, reason: str = ""
    ) -> dict[str, Any]:
        plan = await self.get_plan(plan_id)
        if plan.workspace_id != workspace_id:
            raise NotFoundError(
                message="Plan not found in this workspace", details={"plan_id": str(plan_id)}
            )
        if plan.status not in (PlanStatus.WAITING_REVIEW, PlanStatus.APPROVED):
            raise BadRequestError(
                message=f"Plan cannot be rejected in status '{plan.status}'",
                details={"plan_id": str(plan_id), "status": plan.status},
            )
        plan.status = PlanStatus.REJECTED
        if reason:
            plan.error_message = reason[:2000]
        await self.db.flush()

        # Mark all pending drafts for this plan as rejected
        draft_result = await self.db.execute(
            select(ChironWikiDraft).where(
                ChironWikiDraft.plan_id == plan_id,
                ChironWikiDraft.status == DraftStatus.PENDING,
            )
        )
        for draft in draft_result.scalars().all():
            draft.status = DraftStatus.REJECTED
            draft.reviewer_note = reason or "Plan rejected."
        await self.db.flush()

        return {"plan_id": str(plan_id), "status": "rejected"}

    # ── Sources CRUD ──────────────────────────────────────────────────────────

    async def list_sources(self, workspace_id: uuid.UUID) -> list[ChironSource]:
        result = await self.db.execute(
            select(ChironSource)
            .where(ChironSource.workspace_id == workspace_id)
            .order_by(ChironSource.created_at.desc())
        )
        return list(result.scalars().all())
