"""MRP pipeline orchestrator.

Runs the six phases for a single ChironSource and tracks progress in
ChironCompilationPlan. The VERIFY phase stops here — COMMIT is triggered
separately via the approve endpoint.

Usage (from an arq worker task):
    await run_mrp_pipeline(source_id, workspace_id)
"""

from __future__ import annotations

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.chiron.ai.mrp import phases
from app.chiron.ai.mrp.schemas import ChunkExtract, ProposedPage
from app.db.models.chiron import (
    ChironChunkExtract,
    ChironCompilationPlan,
    ChironSource,
    ChironWikiDraft,
    DraftStatus,
    MRPPhase,
    PlanStatus,
    SourceStatus,
)
from app.db.session import get_db_context

logger = logging.getLogger(__name__)


async def run_mrp_pipeline(source_id: str, workspace_id: str) -> str:
    """Run TRIAGE→MAP→REDUCE→REFINE→VERIFY for source_id.

    Returns the compilation_plan_id string.
    Raises on unrecoverable error (caller should update plan status).
    """
    src_uuid = uuid.UUID(source_id)
    ws_uuid = uuid.UUID(workspace_id)

    # Create or reuse the compilation plan
    async with get_db_context() as db:
        plan = await _get_or_create_plan(db, src_uuid, ws_uuid)
        plan_id = plan.id
        source_content = await _get_source_content(db, src_uuid)
        file_path = await _get_source_path(db, src_uuid)

    if not source_content:
        async with get_db_context() as db:
            await _fail_plan(db, plan_id, "Source has no raw_content to process.")
        return str(plan_id)

    try:
        # ── TRIAGE ──────────────────────────────────────────────────────────
        await _set_phase(plan_id, MRPPhase.TRIAGE, PlanStatus.RUNNING)
        triage_out = await phases.run_triage(source_content, file_path)
        await _save_phase_result(plan_id, MRPPhase.TRIAGE, triage_out.model_dump())
        logger.info("Chiron TRIAGE done: source=%s type=%s", source_id, triage_out.doc_type)

        # ── MAP ─────────────────────────────────────────────────────────────
        await _set_phase(plan_id, MRPPhase.MAP, PlanStatus.RUNNING)
        chunks = await phases.run_map(source_content)
        await _save_phase_result(plan_id, MRPPhase.MAP, {"chunk_count": len(chunks)})
        await _save_chunks(plan_id, src_uuid, chunks)
        logger.info("Chiron MAP done: source=%s chunks=%d", source_id, len(chunks))

        # ── REDUCE ──────────────────────────────────────────────────────────
        await _set_phase(plan_id, MRPPhase.REDUCE, PlanStatus.RUNNING)
        proposed = await phases.run_reduce(chunks, triage_out.doc_type, file_path)
        await _save_phase_result(plan_id, MRPPhase.REDUCE, {"page_count": len(proposed)})
        logger.info("Chiron REDUCE done: source=%s pages=%d", source_id, len(proposed))

        # ── REFINE ──────────────────────────────────────────────────────────
        await _set_phase(plan_id, MRPPhase.REFINE, PlanStatus.RUNNING)
        refined = await phases.run_refine(proposed)
        await _save_phase_result(plan_id, MRPPhase.REFINE, {"page_count": len(refined)})
        logger.info("Chiron REFINE done: source=%s pages=%d", source_id, len(refined))

        # ── VERIFY (human gate) ─────────────────────────────────────────────
        await _set_verify_waiting(plan_id, ws_uuid, src_uuid, refined)
        logger.info(
            "Chiron VERIFY: source=%s plan=%s waiting for human approval",
            source_id,
            plan_id,
        )

    except Exception as exc:
        logger.exception("Chiron MRP pipeline failed for source %s", source_id)
        async with get_db_context() as db:
            await _fail_plan(db, plan_id, str(exc))
            await _fail_source(db, src_uuid, str(exc))

    return str(plan_id)


async def commit_plan(plan_id: str, workspace_id: str, changed_by: str | None = None) -> list[str]:
    """COMMIT phase — apply approved proposed_pages to ChironWikiPage records.

    Returns list of committed page_id strings.
    """
    import hashlib
    import math
    import re
    from collections import Counter

    plan_uuid = uuid.UUID(plan_id)
    ws_uuid = uuid.UUID(workspace_id)

    async with get_db_context() as db:
        from sqlalchemy import select

        from app.db.models.chiron import ChironPageSource, ChironWikiPage, ChironWikiRevision

        result = await db.execute(
            select(ChironCompilationPlan).where(ChironCompilationPlan.id == plan_uuid)
        )
        plan = result.scalar_one_or_none()
        if plan is None or plan.proposed_pages is None:
            raise ValueError(f"Plan {plan_id} not found or has no proposed pages.")

        plan.phase = MRPPhase.COMMIT
        plan.status = PlanStatus.RUNNING
        await db.flush()

        # Fetch source for linking
        src_result = await db.execute(
            select(ChironSource).where(ChironSource.id == plan.source_id)
        )
        source = src_result.scalar_one_or_none()

        committed_ids: list[str] = []

        for page_data in plan.proposed_pages:
            title = page_data.get("title", "Untitled")
            content = page_data.get("content", "")
            summary = page_data.get("summary", "")
            tags = page_data.get("tags", [])

            # Upsert wiki page by title + workspace
            pg_result = await db.execute(
                select(ChironWikiPage).where(
                    ChironWikiPage.workspace_id == ws_uuid,
                    ChironWikiPage.title == title,
                )
            )
            page = pg_result.scalar_one_or_none()

            if page:
                old_revision = page.revision
                # Save revision snapshot before overwriting
                rev = ChironWikiRevision(
                    page_id=page.id,
                    revision=old_revision,
                    content=page.content,
                    changed_by=changed_by,
                )
                db.add(rev)
                page.content = content
                page.summary = summary
                page.tags = tags
                page.revision = old_revision + 1
            else:
                page = ChironWikiPage(
                    workspace_id=ws_uuid,
                    title=title,
                    content=content,
                    summary=summary,
                    tags=tags,
                )
                db.add(page)
                await db.flush()
                await db.refresh(page)

            # Link source → page
            if source:
                assoc_result = await db.execute(
                    select(ChironPageSource).where(
                        ChironPageSource.page_id == page.id,
                        ChironPageSource.source_id == source.id,
                    )
                )
                if not assoc_result.scalar_one_or_none():
                    assoc = ChironPageSource(page_id=page.id, source_id=source.id)
                    db.add(assoc)

            committed_ids.append(str(page.id))

        # Mark source as done
        if source:
            source.status = SourceStatus.DONE

        plan.phase = MRPPhase.COMMIT
        plan.status = PlanStatus.DONE
        await db.flush()

        logger.info("Chiron COMMIT done: plan=%s pages=%d", plan_id, len(committed_ids))
        return committed_ids


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _get_or_create_plan(
    db: AsyncSession, source_id: uuid.UUID, workspace_id: uuid.UUID
) -> ChironCompilationPlan:
    from sqlalchemy import select

    result = await db.execute(
        select(ChironCompilationPlan).where(
            ChironCompilationPlan.source_id == source_id,
            ChironCompilationPlan.status.not_in([PlanStatus.DONE, PlanStatus.APPROVED]),
        )
    )
    plan = result.scalar_one_or_none()
    if plan:
        return plan

    plan = ChironCompilationPlan(
        source_id=source_id,
        workspace_id=workspace_id,
    )
    db.add(plan)
    await db.flush()
    await db.refresh(plan)
    return plan


async def _get_source_content(db: AsyncSession, source_id: uuid.UUID) -> str | None:
    from sqlalchemy import select

    result = await db.execute(
        select(ChironSource.raw_content).where(ChironSource.id == source_id)
    )
    row = result.one_or_none()
    return row[0] if row else None


async def _get_source_path(db: AsyncSession, source_id: uuid.UUID) -> str:
    from sqlalchemy import select

    result = await db.execute(
        select(ChironSource.file_path).where(ChironSource.id == source_id)
    )
    row = result.one_or_none()
    return row[0] if row else "unknown"


async def _set_phase(plan_id: uuid.UUID, phase: MRPPhase, status: PlanStatus) -> None:
    async with get_db_context() as db:
        from sqlalchemy import update

        await db.execute(
            update(ChironCompilationPlan)
            .where(ChironCompilationPlan.id == plan_id)
            .values(phase=phase, status=status)
        )


async def _save_phase_result(plan_id: uuid.UUID, phase: MRPPhase, result: dict) -> None:
    async with get_db_context() as db:
        from sqlalchemy import select

        res = await db.execute(
            select(ChironCompilationPlan).where(ChironCompilationPlan.id == plan_id)
        )
        plan = res.scalar_one_or_none()
        if plan:
            current = plan.phase_results or {}
            plan.phase_results = {**current, phase: result}
            await db.flush()


async def _save_chunks(
    plan_id: uuid.UUID, source_id: uuid.UUID, chunks: list[ChunkExtract]
) -> None:
    async with get_db_context() as db:
        for i, chunk in enumerate(chunks):
            extract = ChironChunkExtract(
                plan_id=plan_id,
                source_id=source_id,
                chunk_index=i,
                title=chunk.title,
                content=chunk.content,
                entities=chunk.entities,
                summary=chunk.summary,
            )
            db.add(extract)
        await db.flush()


async def _set_verify_waiting(
    plan_id: uuid.UUID,
    workspace_id: uuid.UUID,
    source_id: uuid.UUID,
    pages: list[ProposedPage],
) -> None:
    async with get_db_context() as db:
        from sqlalchemy import select

        res = await db.execute(
            select(ChironCompilationPlan).where(ChironCompilationPlan.id == plan_id)
        )
        plan = res.scalar_one_or_none()
        if plan:
            plan.phase = MRPPhase.VERIFY
            plan.status = PlanStatus.WAITING_REVIEW
            plan.proposed_pages = [p.model_dump() for p in pages]
            await db.flush()

        # Create wiki drafts for each proposed page
        for page in pages:
            draft = ChironWikiDraft(
                workspace_id=workspace_id,
                plan_id=plan_id,
                title=page.title,
                content=page.content,
                rationale=f"Generated by MRP pipeline from source {source_id}",
                status=DraftStatus.PENDING,
            )
            db.add(draft)
        await db.flush()


async def _fail_plan(db: AsyncSession, plan_id: uuid.UUID, error: str) -> None:
    from sqlalchemy import select

    res = await db.execute(
        select(ChironCompilationPlan).where(ChironCompilationPlan.id == plan_id)
    )
    plan = res.scalar_one_or_none()
    if plan:
        plan.status = PlanStatus.ERROR
        plan.error_message = error[:2000]
        await db.flush()


async def _fail_source(db: AsyncSession, source_id: uuid.UUID, error: str) -> None:
    from sqlalchemy import select

    res = await db.execute(select(ChironSource).where(ChironSource.id == source_id))
    src = res.scalar_one_or_none()
    if src:
        src.status = SourceStatus.ERROR
        src.error_message = error[:500]
        await db.flush()
