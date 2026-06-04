"""RAG sync service — fetches external sources and stores them as chunks."""

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import sync_source as sync_repo
from app.services.rag_document import chunk_and_store

logger = logging.getLogger(__name__)


async def _fetch_url(url: str) -> str:
    """Fetch a URL and return its content as plain text."""
    try:
        import httpx

        from app.agents.tools.token_compression import collapse_whitespace, html_to_text

        async with httpx.AsyncClient(
            timeout=15.0,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; RAGSyncBot)"},
        ) as client:
            response = await client.get(url)
            response.raise_for_status()
            content_type = response.headers.get("content-type", "")
            raw = response.text
            text = html_to_text(raw) if "html" in content_type else raw
            return collapse_whitespace(text)
    except Exception as exc:
        logger.warning("Failed to fetch %r: %s", url, exc)
        return ""


async def _fetch_github_readme(owner: str, repo: str, branch: str = "main") -> str:
    """Fetch a README from a public GitHub repository."""
    for b in (branch, "master", "main"):
        url = f"https://raw.githubusercontent.com/{owner}/{repo}/{b}/README.md"
        text = await _fetch_url(url)
        if text:
            return text
    logger.warning("Could not fetch README for %s/%s", owner, repo)
    return ""


async def sync_source_by_id(db: AsyncSession, source_id: str) -> int:
    """Sync a single source by its UUID string. Returns number of chunks stored."""
    try:
        sid = uuid.UUID(source_id)
    except ValueError:
        logger.error("Invalid sync source UUID: %s", source_id)
        return 0

    source = await sync_repo.get_by_id(db, sid)
    if not source or not source.is_active:
        return 0

    text = ""
    source_ref = str(source.id)

    if source.source_type == "url":
        url = source.config.get("url", "")
        if url:
            text = await _fetch_url(url)
    elif source.source_type == "github":
        owner = source.config.get("owner", "")
        repo = source.config.get("repo", "")
        branch = source.config.get("branch", "main")
        if owner and repo:
            text = await _fetch_github_readme(owner, repo, branch)
    elif source.source_type == "text":
        text = source.config.get("content", "")

    if not text:
        logger.warning("No content retrieved for source %r (%s)", source.name, source.source_type)
        return 0

    count = await chunk_and_store(
        db,
        text=text,
        title=source.name,
        source_type=source.source_type,
        source_ref=source_ref,
        extra={"source_id": str(source.id), "source_name": source.name},
    )
    await sync_repo.update_last_synced(db, source)
    return count


async def sync_all(db: AsyncSession) -> dict[str, int]:
    """Sync all active sources. Returns mapping of {source_name: chunks_stored}."""
    sources = await sync_repo.list_active(db)
    results: dict[str, int] = {}

    for source in sources:
        try:
            count = await sync_source_by_id(db, str(source.id))
            results[source.name] = count
            logger.info("Synced %r → %d chunks", source.name, count)
        except Exception as exc:
            logger.error("Sync failed for %r: %s", source.name, exc)
            results[source.name] = 0

    return results
