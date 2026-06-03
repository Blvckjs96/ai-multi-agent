"""Context Builder for the local AI agent (OllamaCodeSession).

Composes a context string from three sources — each already implemented
in Argo — and returns a single string suitable for --append-system-prompt:

  1. argomemory LTM recall      → past lessons / user preferences
  2. Chiron RAG                 → relevant wiki pages for the query
  3. codegraph symbol lookup    → precise symbol context (no-op if unindexed)
  4. argomemory STM context     → observations from a resumed session

Each source is budget-capped; the combined result is hard-capped at
LOCAL_CONTEXT_TOKENS * 4 characters (≈ token estimate).
"""

from __future__ import annotations

import logging
import sqlite3
import re
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services.memory_svc import memory_svc, project_name_from_path

logger = logging.getLogger(__name__)

# Rough char-to-token ratio used for budget estimates.
_CHARS_PER_TOKEN = 4
_MAX_CHARS = settings.LOCAL_CONTEXT_TOKENS * _CHARS_PER_TOKEN  # default 24 000


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def build_context(
    query: str,
    *,
    workspace_id: UUID | None = None,
    workspace_path: str | None = None,
    session_id: str | None = None,
    db: AsyncSession | None = None,
) -> str:
    """Return a composed context string for injection into a local model session.

    Sources are gathered independently; any failure is non-fatal (logged +
    skipped) so a broken Chiron or argomemory never prevents the session.
    """
    parts: list[str] = []
    budget_remaining = _MAX_CHARS

    # ── Source 1: argomemory LTM recall ─────────────────────────────────────
    ltm = await _ltm_context(query, budget=min(1500 * _CHARS_PER_TOKEN, budget_remaining))
    if ltm:
        parts.append(ltm)
        budget_remaining -= len(ltm)

    # ── Source 2: Chiron RAG ─────────────────────────────────────────────────
    if workspace_id and db is not None and budget_remaining > 0:
        rag = await _chiron_context(workspace_id, query, db, budget=budget_remaining)
        if rag:
            parts.append(rag)
            budget_remaining -= len(rag)

    # ── Source 3: codegraph symbol context ───────────────────────────────────
    if workspace_path and budget_remaining > 0:
        cg = _codegraph_context(workspace_path, query, budget=budget_remaining)
        if cg:
            parts.append(cg)
            budget_remaining -= len(cg)

    # ── Source 4: argomemory STM (resumed session) ───────────────────────────
    if session_id and budget_remaining > 0:
        stm = await _stm_context(session_id, workspace_path, budget=budget_remaining)
        if stm:
            parts.append(stm)

    if not parts:
        return ""

    combined = "\n\n".join(parts)
    if len(combined) > _MAX_CHARS:
        combined = combined[:_MAX_CHARS] + "\n[context truncated]"
    return combined


# ---------------------------------------------------------------------------
# Source implementations
# ---------------------------------------------------------------------------


async def _ltm_context(query: str, budget: int) -> str | None:
    """Recall relevant past lessons from argomemory LTM."""
    token_budget = budget // _CHARS_PER_TOKEN
    try:
        result = await memory_svc.recall_context(query, token_budget=token_budget)
        return result
    except Exception as exc:
        logger.debug("LTM recall failed (non-fatal): %s", exc)
        return None


async def _chiron_context(
    workspace_id: UUID,
    query: str,
    db: AsyncSession,
    budget: int,
) -> str | None:
    """Search Chiron wiki for pages relevant to the query."""
    from app.services.chiron import ChironService

    try:
        chiron = ChironService(db)
        results = await chiron.search(workspace_id, query, top_k=4)
        if not results:
            return None
        return _format_rag_results(results, budget)
    except Exception as exc:
        logger.debug("Chiron RAG failed (non-fatal): %s", exc)
        return None


def _format_rag_results(results: list[dict[str, Any]], budget: int) -> str:
    """Format Chiron search results into a compact context block."""
    lines = ["[Relevant knowledge from Chiron workspace]"]
    used = len(lines[0])
    for r in results:
        title = r.get("title", "Untitled")
        summary = r.get("summary") or r.get("content", "")
        score = r.get("score", 0.0)
        entry = f"\n### {title} (relevance: {score:.2f})\n{summary}"
        if used + len(entry) > budget:
            break
        lines.append(entry)
        used += len(entry)
    lines.append("\n[End knowledge]")
    return "\n".join(lines)


def _codegraph_context(workspace_path: str, query: str, budget: int) -> str | None:
    """Query .codegraph/index.db for symbols matching query tokens.

    Uses a simple FTS-style LIKE search since codegraph uses SQLite.
    Returns None gracefully when the index doesn't exist.
    """
    db_path = Path(workspace_path) / ".codegraph" / "index.db"
    if not db_path.exists():
        return None

    try:
        tokens = [t for t in re.split(r"[^a-zA-Z0-9_]", query) if len(t) > 2]
        if not tokens:
            return None

        con = sqlite3.connect(str(db_path), timeout=2.0)
        con.row_factory = sqlite3.Row

        # Try to query a 'nodes' or 'symbols' table — codegraph schema varies.
        # Attempt common table/column names; skip silently if schema differs.
        rows: list[sqlite3.Row] = []
        for table in ("nodes", "symbols", "code_nodes"):
            for col in ("name", "symbol_name", "identifier"):
                try:
                    placeholders = " OR ".join(f"{col} LIKE ?" for _ in tokens)
                    params = [f"%{t}%" for t in tokens]
                    cur = con.execute(
                        f"SELECT * FROM {table} WHERE {placeholders} LIMIT 8",
                        params,
                    )
                    rows = cur.fetchall()
                    if rows:
                        break
                except sqlite3.OperationalError:
                    continue
            if rows:
                break
        con.close()

        if not rows:
            return None

        lines = ["[Relevant symbols from codegraph index]"]
        used = len(lines[0])
        for row in rows:
            d = dict(row)
            name = d.get("name") or d.get("symbol_name") or d.get("identifier", "?")
            kind = d.get("kind") or d.get("type", "")
            file_ = d.get("file") or d.get("file_path", "")
            line_ = d.get("line") or d.get("start_line", "")
            entry = f"\n- {kind} `{name}` in {file_}:{line_}"
            if used + len(entry) > budget:
                break
            lines.append(entry)
            used += len(entry)
        lines.append("\n[End symbols]")
        return "\n".join(lines)

    except Exception as exc:
        logger.debug("codegraph context failed (non-fatal): %s", exc)
        return None


async def _stm_context(
    session_id: str,
    workspace_path: str | None,
    budget: int,
) -> str | None:
    """Retrieve STM session observations for a resumed session."""
    try:
        project = project_name_from_path(workspace_path) if workspace_path else ""
        token_budget = budget // _CHARS_PER_TOKEN
        result = await memory_svc.get_session_context(
            session_id,
            project=project,
            budget=token_budget,
        )
        return result
    except Exception as exc:
        logger.debug("STM context failed (non-fatal): %s", exc)
        return None
