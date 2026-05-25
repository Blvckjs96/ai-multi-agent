"""arq task: generate and store pgvector embeddings for Chiron wiki pages."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def embed_page_task(ctx: dict, page_id: str) -> dict:
    """Compute and upsert the embedding for a single wiki page.

    Enqueued by commit_plan_task after pages are written, and by the MCP
    edit_wiki_page tool after a direct edit.
    """
    import uuid

    from sqlalchemy import select

    from app.chiron.ai.embedding_service import get_embedding_service
    from app.db.models.chiron import ChironWikiPage
    from app.db.session import get_worker_db_context

    svc = get_embedding_service()
    if not svc.is_available:
        logger.info(
            "embed_page_task: embeddings disabled (no OPENAI_API_KEY), skipping page=%s", page_id
        )
        return {"status": "skipped", "reason": "no_api_key", "page_id": page_id}

    page_uuid = uuid.UUID(page_id)
    async with get_worker_db_context() as db:
        result = await db.execute(
            select(ChironWikiPage.title, ChironWikiPage.content).where(
                ChironWikiPage.id == page_uuid
            )
        )
        row = result.one_or_none()
        if row is None:
            logger.warning("embed_page_task: page %s not found", page_id)
            return {"status": "not_found", "page_id": page_id}

        title, content = row
        wrote = await svc.upsert_page(db, page_uuid, title, content)

    if wrote:
        logger.info("embed_page_task: embedded page=%s", page_id)
    else:
        logger.debug("embed_page_task: page=%s hash unchanged, skipped", page_id)

    return {"status": "ok", "wrote": wrote, "page_id": page_id}
