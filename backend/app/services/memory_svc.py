"""Argomemory service — STM + LTM Memory Brain for Argo.

Architecture — two complementary paths:

  REST (this file):
    Argo's backend talks to argomemory's REST API for structured operations
    that the backend owns: session lifecycle, real-time observations, context
    re-injection, and post-session summarisation.

  MCP (via claude_cli.py):
    argomemory's standalone MCP server is injected into every Claude CLI
    subprocess via --mcp-config so Claude can call memory_recall,
    memory_save, etc. natively during a session.

Memory tiers:
  STM — session-scoped working + episodic memory (observations per session)
  LTM — cross-session semantic + procedural memory (consolidated facts)

  Flow:
    session/start  → register session, get STM context for new/resumed sessions
    observe        → write individual tool/conversation observations in real-time
    session/end    → mark session completed
    summarize      → LLM generates SessionSummary (episodic → STM)
    reflect        → extract lessons from summary (episodic → LTM)
    save_insight   → explicit LTM write
    consolidate    → nightly pipeline: episodic → semantic → procedural

REST endpoints used:
  POST /argomemory/session/start   register + get context
  POST /argomemory/session/end     mark completed
  POST /argomemory/observe         write single observation (STM)
  POST /argomemory/context         get enriched session context (for resume)
  POST /argomemory/summarize       generate episodic memory from session
  GET  /argomemory/livez           health probe
  POST /argomemory/mcp/call        generic MCP tool proxy
"""

from __future__ import annotations

import logging
import os
from datetime import UTC, datetime
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_PROBE_TIMEOUT = 2.0   # fast-fail: health check + observe (fire-and-forget)
_CALL_TIMEOUT = 10.0   # tool calls, context fetch, summarise
_MAX_OBS_PER_SESSION = 50  # cap to prevent flooding long tool chains


class ArgoMemoryService:
    """Async client for the argomemory REST API."""

    def __init__(self) -> None:
        self._headers: dict[str, str] = {}
        if settings.ARGOMEMORY_SECRET:
            self._headers["Authorization"] = f"Bearer {settings.ARGOMEMORY_SECRET}"

    # ------------------------------------------------------------------
    # Session lifecycle (STM)
    # ------------------------------------------------------------------

    async def start_session(
        self,
        session_id: str,
        project: str,
        cwd: str,
    ) -> str | None:
        """Register a session with argomemory and return its STM context string.

        For new sessions this returns None (no prior observations yet).
        For resumed sessions the caller should use get_session_context() before
        the subprocess starts instead; this call is still useful to re-sync the
        session record in argomemory's KV store.

        Silently returns None on failure — session tracking is best-effort.
        """
        if not settings.ARGOMEMORY_ENABLED or not session_id:
            return None
        try:
            async with httpx.AsyncClient(timeout=_CALL_TIMEOUT) as client:
                r = await client.post(
                    f"{settings.ARGOMEMORY_URL}/argomemory/session/start",
                    json={"sessionId": session_id, "project": project, "cwd": cwd},
                    headers={**self._headers, "Content-Type": "application/json"},
                )
                if r.is_success:
                    body = r.json()
                    ctx: str = body.get("context") or ""
                    return ctx if ctx.strip() else None
        except Exception as exc:
            logger.debug("argomemory start_session failed (non-fatal): %s", exc)
        return None

    async def end_session(self, session_id: str) -> None:
        """Mark session as completed in argomemory (best-effort)."""
        if not settings.ARGOMEMORY_ENABLED or not session_id:
            return
        try:
            async with httpx.AsyncClient(timeout=_PROBE_TIMEOUT) as client:
                await client.post(
                    f"{settings.ARGOMEMORY_URL}/argomemory/session/end",
                    json={"sessionId": session_id},
                    headers={**self._headers, "Content-Type": "application/json"},
                )
        except Exception as exc:
            logger.debug("argomemory end_session failed (non-fatal): %s", exc)

    async def observe(
        self,
        session_id: str,
        hook_type: str,
        data: dict[str, Any],
    ) -> None:
        """Write a single STM observation for the current session (best-effort).

        hook_type should be one of: "post_tool_use", "prompt_submit",
        "pre_tool_use", "post_tool_failure".

        Called fire-and-forget from the SSE event loop — must not raise.
        Capped at _MAX_OBS_PER_SESSION calls per session via the caller.
        """
        if not settings.ARGOMEMORY_ENABLED or not session_id:
            return
        payload = {
            "sessionId": session_id,
            "hookType": hook_type,
            "timestamp": datetime.now(UTC).isoformat(),
            "data": data,
        }
        try:
            async with httpx.AsyncClient(timeout=_PROBE_TIMEOUT) as client:
                await client.post(
                    f"{settings.ARGOMEMORY_URL}/argomemory/observe",
                    json=payload,
                    headers={**self._headers, "Content-Type": "application/json"},
                )
        except Exception as exc:
            logger.debug("argomemory observe failed (non-fatal): %s", exc)

    async def get_session_context(
        self,
        session_id: str,
        project: str,
        budget: int = 800,
    ) -> str | None:
        """Fetch the enriched STM context for an existing session.

        Used on resume: Claude's context window may have been compacted, but
        argomemory still holds all observations from prior turns.  We re-inject
        this context as --append-system-prompt so Claude remembers what it did.
        """
        if not settings.ARGOMEMORY_ENABLED or not session_id:
            return None
        try:
            async with httpx.AsyncClient(timeout=_CALL_TIMEOUT) as client:
                r = await client.post(
                    f"{settings.ARGOMEMORY_URL}/argomemory/context",
                    json={"sessionId": session_id, "project": project, "budget": budget},
                    headers={**self._headers, "Content-Type": "application/json"},
                )
                if r.is_success:
                    ctx: str = (r.json().get("context") or "").strip()
                    if ctx:
                        return f"[Session context from argomemory]\n{ctx}\n[End context]"
        except Exception as exc:
            logger.debug("argomemory get_session_context failed (non-fatal): %s", exc)
        return None

    async def summarize_session(self, session_id: str) -> None:
        """Ask argomemory to summarise the session into episodic memory (best-effort).

        Generates a SessionSummary from accumulated observations — this is the
        bridge from raw STM observations to structured episodic memory that the
        consolidation pipeline can promote to LTM.
        """
        if not settings.ARGOMEMORY_ENABLED or not session_id:
            return
        try:
            async with httpx.AsyncClient(timeout=_CALL_TIMEOUT) as client:
                await client.post(
                    f"{settings.ARGOMEMORY_URL}/argomemory/summarize",
                    json={"sessionId": session_id},
                    headers={**self._headers, "Content-Type": "application/json"},
                )
        except Exception as exc:
            logger.debug("argomemory summarize_session failed (non-fatal): %s", exc)

    # ------------------------------------------------------------------
    # LTM — recall and save (existing, kept for backwards compat)
    # ------------------------------------------------------------------

    async def is_healthy(self) -> bool:
        """Return True if the argomemory server responds to its livez probe."""
        if not settings.ARGOMEMORY_ENABLED:
            return False
        try:
            async with httpx.AsyncClient(timeout=_PROBE_TIMEOUT) as client:
                r = await client.get(
                    f"{settings.ARGOMEMORY_URL}/argomemory/livez",
                    headers=self._headers,
                )
                return r.is_success
        except Exception:
            return False

    async def recall_context(
        self,
        query: str,
        token_budget: int = 600,
    ) -> str | None:
        """Search argomemory LTM for context relevant to *query*.

        Uses memory_smart_search (BM25 + semantic re-rank) for quality recall.
        Returns a compact string suitable for --append-system-prompt, or None.
        """
        if not settings.ARGOMEMORY_ENABLED or not query.strip():
            return None

        result = await self._call_tool(
            "memory_smart_search",
            {"query": query, "limit": 5, "token_budget": token_budget},
        )
        if result is None:
            return None

        text = _extract_text(result)
        if not text or text.strip() in ("[]", "{}", "null", ""):
            return None

        return f"[Relevant past context from argomemory]\n{text}\n[End context]"

    async def reflect(self, session_summary: str) -> None:
        """Extract and persist lessons from a completed session (best-effort)."""
        if not settings.ARGOMEMORY_ENABLED or not session_summary.strip():
            return
        try:
            await self._call_tool(
                "memory_reflect",
                {"session_summary": session_summary, "extract_lessons": True},
            )
        except Exception as exc:
            logger.debug("argomemory reflect failed (non-fatal): %s", exc)

    async def consolidate(self) -> None:
        """Merge duplicate memories and prune low-value entries (best-effort)."""
        if not settings.ARGOMEMORY_ENABLED:
            return
        try:
            await self._call_tool("memory_consolidate", {"dry_run": False})
        except Exception as exc:
            logger.debug("argomemory consolidate failed (non-fatal): %s", exc)

    async def save_insight(
        self,
        content: str,
        memory_type: str = "fact",
        concepts: list[str] | None = None,
    ) -> None:
        """Persist an insight to argomemory LTM (best-effort)."""
        if not settings.ARGOMEMORY_ENABLED or not content.strip():
            return

        args: dict[str, Any] = {"content": content, "type": memory_type}
        if concepts:
            args["concepts"] = ",".join(concepts)

        try:
            await self._call_tool("memory_save", args)
        except Exception as exc:
            logger.debug("argomemory save_insight failed (non-fatal): %s", exc)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _call_tool(
        self,
        name: str,
        arguments: dict[str, Any],
    ) -> dict[str, Any] | None:
        """POST /argomemory/mcp/call — call an argomemory MCP tool via REST."""
        try:
            async with httpx.AsyncClient(timeout=_CALL_TIMEOUT) as client:
                r = await client.post(
                    f"{settings.ARGOMEMORY_URL}/argomemory/mcp/call",
                    json={"name": name, "arguments": arguments},
                    headers={**self._headers, "Content-Type": "application/json"},
                )
                if not r.is_success:
                    logger.debug(
                        "argomemory %s returned %d: %s",
                        name,
                        r.status_code,
                        r.text[:200],
                    )
                    return None
                return r.json()
        except httpx.TimeoutException:
            logger.debug("argomemory %s timed out", name)
            return None
        except Exception as exc:
            logger.debug("argomemory %s error: %s", name, exc)
            return None


def _extract_text(result: dict[str, Any]) -> str:
    """Pull the first text block out of an argomemory MCP response."""
    content = result.get("content") or []
    if isinstance(content, list):
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                return str(block.get("text", ""))
    if isinstance(result, dict) and "text" in result:
        return str(result["text"])
    return ""


def project_name_from_path(workspace_path: str | None) -> str:
    """Derive a short project name from a filesystem path."""
    if not workspace_path:
        return "default"
    return os.path.basename(workspace_path.rstrip("/")) or "default"


# Module-level singleton — import this, don't instantiate.
memory_svc = ArgoMemoryService()
