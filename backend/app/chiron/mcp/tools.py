"""Chiron MCP tool implementations — wiki query and edit tools.

All tools require a valid X-Mcp-Token header and a workspace_id argument.
Tools are registered on the shared `mcp` instance in server.py.
"""

from __future__ import annotations

import json
import logging
from uuid import UUID

from fastmcp import Context, FastMCP
from fastmcp.server.dependencies import get_http_request
from sqlalchemy import func, or_, select

from app.chiron.mcp.auth import resolve_identity_or_raise
from app.db.models.chiron import (
    ChironSource,
    ChironWikiDraft,
    ChironWikiLink,
    ChironWikiPage,
    DraftStatus,
)
from app.db.session import get_db_context

logger = logging.getLogger(__name__)


def register_tools(mcp: FastMCP) -> None:
    """Register all Chiron tools on the given FastMCP instance."""

    # ------------------------------------------------------------------
    # Read tools
    # ------------------------------------------------------------------

    @mcp.tool()
    async def read_wiki_index(workspace_id: str, ctx: Context) -> str:
        """Return a compact index (title + summary) of all wiki pages in a workspace.

        Use this first to understand what knowledge is available before
        calling read_wiki_page for specific pages.
        """
        token = _token(ctx)
        ws_uuid = UUID(workspace_id)
        async with get_db_context() as db:
            await resolve_identity_or_raise(db, token)
            result = await db.execute(
                select(ChironWikiPage.id, ChironWikiPage.title, ChironWikiPage.summary)
                .where(ChironWikiPage.workspace_id == ws_uuid)
                .order_by(ChironWikiPage.title)
            )
            rows = result.all()

        if not rows:
            return "No wiki pages found in this workspace."

        lines = [f"## Wiki Index ({len(rows)} pages)\n"]
        for page_id, title, summary in rows:
            lines.append(f"### {title}")
            lines.append(f"ID: {page_id}")
            if summary:
                lines.append(summary)
            lines.append("")
        return "\n".join(lines)

    @mcp.tool()
    async def list_wiki_pages(
        workspace_id: str, ctx: Context, skip: int = 0, limit: int = 50
    ) -> str:
        """List wiki pages with pagination. Returns JSON array of {id, title, tags, revision}."""
        token = _token(ctx)
        ws_uuid = UUID(workspace_id)
        async with get_db_context() as db:
            await resolve_identity_or_raise(db, token)
            result = await db.execute(
                select(
                    ChironWikiPage.id,
                    ChironWikiPage.title,
                    ChironWikiPage.tags,
                    ChironWikiPage.revision,
                )
                .where(ChironWikiPage.workspace_id == ws_uuid)
                .order_by(ChironWikiPage.title)
                .offset(skip)
                .limit(limit)
            )
            rows = result.all()

        items = [{"id": str(r[0]), "title": r[1], "tags": r[2], "revision": r[3]} for r in rows]
        return json.dumps(items, ensure_ascii=False)

    @mcp.tool()
    async def read_wiki_page(workspace_id: str, page_id: str, ctx: Context) -> str:
        """Read the full content of a wiki page by its ID.

        Returns title, content, tags, revision, and linked page titles.
        Use read_wiki_index first to find page IDs.
        """
        token = _token(ctx)
        ws_uuid = UUID(workspace_id)
        page_uuid = UUID(page_id)
        async with get_db_context() as db:
            await resolve_identity_or_raise(db, token)
            result = await db.execute(
                select(ChironWikiPage).where(
                    ChironWikiPage.id == page_uuid,
                    ChironWikiPage.workspace_id == ws_uuid,
                )
            )
            page = result.scalar_one_or_none()
            if page is None:
                return f"Page {page_id} not found in workspace {workspace_id}."

            # Linked pages
            links_result = await db.execute(
                select(ChironWikiPage.title)
                .join(ChironWikiLink, ChironWikiLink.to_page_id == ChironWikiPage.id)
                .where(ChironWikiLink.from_page_id == page_uuid)
            )
            linked_titles = [r[0] for r in links_result.all()]

        parts = [
            f"# {page.title}",
            f"**ID:** {page.id}  |  **Revision:** {page.revision}",
        ]
        if page.tags:
            parts.append(f"**Tags:** {', '.join(page.tags)}")
        parts.extend(["", page.content])
        if linked_titles:
            parts.extend(["", "## Linked Pages", *[f"- {t}" for t in linked_titles]])
        return "\n".join(parts)

    @mcp.tool()
    async def search_wiki(workspace_id: str, query: str, ctx: Context, limit: int = 10) -> str:
        """Search wiki pages using semantic vector search (pgvector) with keyword fallback.

        Returns matching pages with their IDs and summaries.
        For best results, use natural language questions or specific technical terms.
        """
        from app.chiron.ai.embedding_service import get_embedding_service
        from app.services.chiron import ChironService

        token = _token(ctx)
        ws_uuid = UUID(workspace_id)

        async with get_db_context() as db:
            await resolve_identity_or_raise(db, token)

            # Try vector search first
            svc = get_embedding_service()
            if svc.is_available:
                results = await svc.search(db, ws_uuid, query, top_k=limit)
                if results is not None and results:
                    lines = [f"## Search results for '{query}' ({len(results)} matches) [vector]\n"]
                    for r in results:
                        lines.append(f"### {r['title']}")
                        lines.append(f"ID: {r['id']}  |  Score: {r['score']}")
                        if r.get("summary"):
                            lines.append(r["summary"])
                        lines.append("")
                    return "\n".join(lines)

            # Fallback: keyword search
            chiron = ChironService(db)
            keyword_results = await chiron._tfidf_search(ws_uuid, query, top_k=limit, threshold=0.02)

        if not keyword_results:
            return f"No wiki pages matched '{query}'."

        lines = [f"## Search results for '{query}' ({len(keyword_results)} matches) [keyword]\n"]
        for r in keyword_results:
            lines.append(f"### {r['title']}")
            lines.append(f"ID: {r['id']}  |  Score: {r['score']}")
            if r.get("summary"):
                lines.append(r["summary"])
            lines.append("")
        return "\n".join(lines)

    @mcp.tool()
    async def list_sources(workspace_id: str, ctx: Context) -> str:
        """List all ingested source files in a workspace. Returns JSON array."""
        token = _token(ctx)
        ws_uuid = UUID(workspace_id)
        async with get_db_context() as db:
            await resolve_identity_or_raise(db, token)
            result = await db.execute(
                select(
                    ChironSource.id,
                    ChironSource.file_path,
                    ChironSource.mime_type,
                    ChironSource.status,
                )
                .where(ChironSource.workspace_id == ws_uuid)
                .order_by(ChironSource.file_path)
            )
            rows = result.all()

        items = [{"id": str(r[0]), "path": r[1], "mime_type": r[2], "status": r[3]} for r in rows]
        return json.dumps(items, ensure_ascii=False)

    @mcp.tool()
    async def get_source(workspace_id: str, source_id: str, ctx: Context) -> str:
        """Get metadata for a specific source file by ID."""
        token = _token(ctx)
        ws_uuid = UUID(workspace_id)
        src_uuid = UUID(source_id)
        async with get_db_context() as db:
            await resolve_identity_or_raise(db, token)
            result = await db.execute(
                select(ChironSource).where(
                    ChironSource.id == src_uuid,
                    ChironSource.workspace_id == ws_uuid,
                )
            )
            src = result.scalar_one_or_none()
            if src is None:
                return f"Source {source_id} not found."

        return json.dumps(
            {
                "id": str(src.id),
                "path": src.file_path,
                "mime_type": src.mime_type,
                "status": src.status,
                "content_hash": src.content_hash,
                "error": src.error_message,
                "minio_key": src.minio_key,
            },
            ensure_ascii=False,
        )

    @mcp.tool()
    async def get_source_outline(workspace_id: str, source_id: str, ctx: Context) -> str:
        """Get a short outline (first 2000 chars) of a source's raw content."""
        token = _token(ctx)
        ws_uuid = UUID(workspace_id)
        src_uuid = UUID(source_id)
        async with get_db_context() as db:
            await resolve_identity_or_raise(db, token)
            result = await db.execute(
                select(ChironSource.file_path, ChironSource.raw_content).where(
                    ChironSource.id == src_uuid,
                    ChironSource.workspace_id == ws_uuid,
                )
            )
            row = result.one_or_none()
            if row is None:
                return f"Source {source_id} not found."
            path, raw = row

        if not raw:
            return f"Source '{path}' has no extracted text content."
        return f"# Outline: {path}\n\n{raw[:2000]}{'...' if len(raw) > 2000 else ''}"

    @mcp.tool()
    async def get_source_pages(workspace_id: str, source_id: str, ctx: Context) -> str:
        """List wiki pages that were generated from a specific source file."""
        token = _token(ctx)
        ws_uuid = UUID(workspace_id)
        src_uuid = UUID(source_id)
        async with get_db_context() as db:
            await resolve_identity_or_raise(db, token)
            src_result = await db.execute(
                select(ChironSource).where(
                    ChironSource.id == src_uuid,
                    ChironSource.workspace_id == ws_uuid,
                )
            )
            src = src_result.scalar_one_or_none()
            if src is None:
                return f"Source {source_id} not found."

            # Load wiki pages via the relationship (lazy loaded here)
            page_results = await db.execute(
                select(ChironWikiPage.id, ChironWikiPage.title)
                .join(ChironWikiPage.sources)
                .where(ChironSource.id == src_uuid)
            )
            pages = page_results.all()

        if not pages:
            return f"No wiki pages linked to source '{src.file_path}'."

        lines = [f"## Wiki pages from source '{src.file_path}'"]
        for page_id, title in pages:
            lines.append(f"- **{title}** (ID: {page_id})")
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Write/edit tools
    # ------------------------------------------------------------------

    @mcp.tool()
    async def edit_wiki_page(
        workspace_id: str,
        page_id: str,
        new_content: str,
        ctx: Context,
        reason: str = "",
    ) -> str:
        """Directly edit the content of a wiki page.

        Increments the revision counter. Provide a reason for tracking changes.
        Prefer propose_wiki_edit for significant structural changes that need review.
        """
        token = _token(ctx)
        ws_uuid = UUID(workspace_id)
        page_uuid = UUID(page_id)
        async with get_db_context() as db:
            identity = await resolve_identity_or_raise(db, token)
            result = await db.execute(
                select(ChironWikiPage).where(
                    ChironWikiPage.id == page_uuid,
                    ChironWikiPage.workspace_id == ws_uuid,
                )
            )
            page = result.scalar_one_or_none()
            if page is None:
                return f"Page {page_id} not found."

            old_revision = page.revision
            page.content = new_content
            page.revision = old_revision + 1
            await db.flush()

        logger.info(
            "Chiron wiki page edited: page=%s workspace=%s user=%s reason=%r rev=%d→%d",
            page_id,
            workspace_id,
            identity.user_id,
            reason,
            old_revision,
            old_revision + 1,
        )
        return f"Page '{page.title}' updated to revision {old_revision + 1}."

    @mcp.tool()
    async def propose_wiki_edit(
        workspace_id: str,
        page_id: str,
        proposed_content: str,
        ctx: Context,
        rationale: str = "",
    ) -> str:
        """Propose a wiki page edit for human review (returns a draft ID).

        Use this for significant rewrites or structural changes. A human admin
        can approve or reject drafts via the Argo UI.
        """
        token = _token(ctx)
        ws_uuid = UUID(workspace_id)
        page_uuid = UUID(page_id)
        async with get_db_context() as db:
            identity = await resolve_identity_or_raise(db, token)

            # Verify page exists in this workspace
            page_result = await db.execute(
                select(ChironWikiPage.title).where(
                    ChironWikiPage.id == page_uuid,
                    ChironWikiPage.workspace_id == ws_uuid,
                )
            )
            row = page_result.one_or_none()
            if row is None:
                return f"Page {page_id} not found in workspace {workspace_id}."
            page_title = row[0]

            draft = ChironWikiDraft(
                workspace_id=ws_uuid,
                page_id=page_uuid,
                title=page_title,
                content=proposed_content,
                rationale=rationale or f"Proposed by user {identity.user_id}",
                status=DraftStatus.PENDING,
            )
            db.add(draft)
            await db.flush()
            await db.refresh(draft)
            draft_id = str(draft.id)

        logger.info(
            "Wiki draft created: draft=%s page=%s workspace=%s user=%s",
            draft_id,
            page_id,
            workspace_id,
            identity.user_id,
        )
        return (
            f"Draft created with ID: {draft_id}\n"
            f"Page: {page_title}\n"
            "Status: pending — awaiting human review in the Argo UI."
        )

    @mcp.tool()
    async def list_pending_drafts(workspace_id: str, ctx: Context) -> str:
        """List pending wiki edit drafts awaiting review. Returns JSON array."""
        token = _token(ctx)
        ws_uuid = UUID(workspace_id)
        async with get_db_context() as db:
            await resolve_identity_or_raise(db, token)
            result = await db.execute(
                select(
                    ChironWikiDraft.id,
                    ChironWikiDraft.title,
                    ChironWikiDraft.rationale,
                    ChironWikiDraft.plan_id,
                    ChironWikiDraft.page_id,
                )
                .where(
                    ChironWikiDraft.workspace_id == ws_uuid,
                    ChironWikiDraft.status == DraftStatus.PENDING,
                )
                .order_by(ChironWikiDraft.created_at.desc())
            )
            rows = result.all()

        if not rows:
            return "[]"

        items = [
            {
                "id": str(r[0]),
                "title": r[1],
                "rationale": r[2],
                "plan_id": str(r[3]) if r[3] else None,
                "page_id": str(r[4]) if r[4] else None,
            }
            for r in rows
        ]
        return json.dumps(items, ensure_ascii=False)

    @mcp.tool()
    async def approve_draft(workspace_id: str, draft_id: str, ctx: Context) -> str:
        """Approve a pending wiki edit draft and apply it directly to the wiki page."""
        token = _token(ctx)
        ws_uuid = UUID(workspace_id)
        draft_uuid = UUID(draft_id)
        async with get_db_context() as db:
            identity = await resolve_identity_or_raise(db, token)

            result = await db.execute(
                select(ChironWikiDraft).where(
                    ChironWikiDraft.id == draft_uuid,
                    ChironWikiDraft.workspace_id == ws_uuid,
                )
            )
            draft = result.scalar_one_or_none()
            if draft is None:
                return f"Draft {draft_id} not found."
            if draft.status != DraftStatus.PENDING:
                return f"Draft {draft_id} is already {draft.status}."

            draft.status = DraftStatus.APPROVED
            draft.reviewer_note = f"Approved by {identity.user_id}"

            # Apply to wiki page if linked
            if draft.page_id:
                page_result = await db.execute(
                    select(ChironWikiPage).where(ChironWikiPage.id == draft.page_id)
                )
                page = page_result.scalar_one_or_none()
                if page:
                    page.content = draft.content
                    page.revision += 1

            await db.flush()

        logger.info(
            "Draft approved: draft=%s workspace=%s user=%s",
            draft_id,
            workspace_id,
            identity.user_id,
        )
        return f"Draft {draft_id} approved and applied."

    @mcp.tool()
    async def reject_draft(workspace_id: str, draft_id: str, ctx: Context, reason: str = "") -> str:
        """Reject a pending wiki edit draft."""
        token = _token(ctx)
        ws_uuid = UUID(workspace_id)
        draft_uuid = UUID(draft_id)
        async with get_db_context() as db:
            identity = await resolve_identity_or_raise(db, token)

            result = await db.execute(
                select(ChironWikiDraft).where(
                    ChironWikiDraft.id == draft_uuid,
                    ChironWikiDraft.workspace_id == ws_uuid,
                )
            )
            draft = result.scalar_one_or_none()
            if draft is None:
                return f"Draft {draft_id} not found."
            if draft.status != DraftStatus.PENDING:
                return f"Draft {draft_id} is already {draft.status}."

            draft.status = DraftStatus.REJECTED
            draft.reviewer_note = reason or f"Rejected by {identity.user_id}"
            await db.flush()

        logger.info(
            "Draft rejected: draft=%s workspace=%s user=%s reason=%r",
            draft_id,
            workspace_id,
            identity.user_id,
            reason,
        )
        return f"Draft {draft_id} rejected."

    @mcp.tool()
    async def list_knowledge_types(workspace_id: str, ctx: Context) -> str:
        """List knowledge categories / types available in this workspace.

        Note: Full knowledge type taxonomy is implemented in Sprint C.
        Returns current wiki page tags as a proxy.
        """
        token = _token(ctx)
        ws_uuid = UUID(workspace_id)
        async with get_db_context() as db:
            await resolve_identity_or_raise(db, token)
            result = await db.execute(
                select(ChironWikiPage.tags).where(
                    ChironWikiPage.workspace_id == ws_uuid,
                    ChironWikiPage.tags.isnot(None),
                )
            )
            all_tags: set[str] = set()
            for (tags,) in result.all():
                if isinstance(tags, list):
                    all_tags.update(str(t) for t in tags)

        if not all_tags:
            return "No knowledge types / tags defined yet."
        return json.dumps(sorted(all_tags), ensure_ascii=False)


def _token(ctx: Context) -> str | None:
    """Extract mcp_token from X-Mcp-Token or Authorization header."""
    try:
        # Use FastMCP dependency to get the underlying HTTP request
        request = get_http_request()
        if request is None:
            # Fallback: try via request_context
            rc = ctx.request_context
            if rc is None:
                return None
            request = getattr(rc, "request", None)
            if request is None:
                return None
        # Prefer explicit header, fall back to Bearer token
        token = request.headers.get("x-mcp-token") or request.headers.get("x-mcp_token")
        if not token:
            auth = request.headers.get("authorization", "")
            if auth.lower().startswith("bearer "):
                token = auth[7:].strip()
        return token or None
    except Exception:
        return None
