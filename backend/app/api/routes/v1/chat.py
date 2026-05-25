"""Chat endpoint — streams Claude CLI events over SSE.

POST /chat/stream      Start or resume a session; streams events back.
POST /chat/confirm     Confirm a plan-mode session (permission_mode=auto).
DELETE /chat/{id}      Cancel an in-flight session.
GET  /chat/sessions    List currently active session IDs.

SSE event format (one per line, double-newline terminated):
    data: {"type": "assistant", "text": "...", "session_id": "..."}
    data: {"type": "tool_use", "tool": "Read", "input": {...}}
    data: {"type": "tool_result", "content": "..."}
    data: {"type": "result", "session_id": "...", "cost_usd": 0.0}
    data: {"type": "error", "message": "..."}
    data: {"type": "done"}
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncGenerator
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

from app.api.deps import DBSession, OptionalCurrentUser, ValidAPIKey
from app.services.change_log_svc import ChangeLogService
from app.services.chat_session import (
    active_session_ids,
    cancel_session,
    get_session_workspace,
    run_session,
)
from app.services.memory_svc import memory_svc, project_name_from_path
from app.services.triage import TaskTriageService, build_context_injection
from app.services.workspace import WorkspaceService

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)

_triage = TaskTriageService()

_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}

# Keeps fire-and-forget tasks alive until they complete (prevents GC).
_bg_tasks: set[asyncio.Task[None]] = set()

# Cap STM observations per session turn to avoid flooding argomemory on
# long tool chains (argomemory deduplicates internally but HTTP overhead adds up).
_MAX_OBS_PER_SESSION = 50


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class ChatStreamRequest(BaseModel):
    message: str
    session_id: str | None = None
    workspace_id: UUID | None = None
    permission_mode: Literal["plan", "auto"] = "plan"


class ChatConfirmRequest(BaseModel):
    session_id: str
    workspace_id: UUID | None = None


# ---------------------------------------------------------------------------
# SSE helpers
# ---------------------------------------------------------------------------


def _sse(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def _normalize_event(event: Any, session_id: str | None) -> dict[str, Any] | None:
    """Convert a CLIEvent to the frontend-facing SSE payload."""
    base: dict[str, Any] = {"type": event.type}
    if session_id:
        base["session_id"] = session_id

    if event.type == "assistant":
        if not event.text:
            return None  # partial with no text yet
        base["text"] = event.text
        if event.subtype:
            base["subtype"] = event.subtype

    elif event.type == "tool_use":
        tool_use = event.data.get("tool_use") or {}
        base["tool"] = tool_use.get("name", "")
        base["input"] = tool_use.get("input", {})

    elif event.type == "tool_result":
        content = event.data.get("tool_result") or {}
        base["content"] = content.get("content", "")

    elif event.type == "result":
        usage = event.data.get("usage") or {}
        base["cost_usd"] = event.data.get("cost_usd", 0.0)
        base["input_tokens"] = usage.get("input_tokens", 0)
        base["output_tokens"] = usage.get("output_tokens", 0)
        if event.session_id:
            base["session_id"] = event.session_id

    elif event.type == "system":
        if event.subtype == "init" and event.session_id:
            base["session_id"] = event.session_id
        else:
            return None  # skip other system events

    elif event.type == "rate_limit_event":
        base["message"] = "Rate limit approaching"

    return base


# ---------------------------------------------------------------------------
# Core SSE generator (shared by /stream and /confirm)
# ---------------------------------------------------------------------------


async def _stream_response(
    body: ChatStreamRequest,
    request: Request | None,
    workspace_path: str | None,
    change_log_id: UUID | None,
    chiron_token: str | None = None,
    chiron_workspace_id: str | None = None,
    tier0_context: str | None = None,
    tier1_context: str | None = None,
) -> AsyncGenerator[str, None]:
    """Generate SSE events for a chat session.

    workspace_path: resolved repo path — sets subprocess cwd for Claude.
    change_log_id: pre-created ChangeLog row to update with session_id on init.
    chiron_token: user mcp_token — when set, Chiron MCP is injected into the session.
    chiron_workspace_id: workspace UUID string for Chiron tool calls.

    Memory flow — 3-layer STM/LTM integration:

      Layer 1 (STM real-time backup):
        • system:init → start_session(session_id) — register in argomemory KV
        • tool_use    → observe(post_tool_use)    — record each tool call (cap 50)
        • result      → end_session + summarize   — create episodic memory

      Layer 2 (context re-injection on resume):
        • New session  → tier0 + tier1 + LTM recall injected via --append-system-prompt
        • Resume session → STM context (session observations) injected instead of LTM
          so Claude regains what it did even if its context window was compacted

      Layer 3 (pre-compact hook — installed globally in ~/.claude/settings.json):
        • PreCompact → dist/hooks/pre-compact.mjs → /argomemory/context
          written to stdout → Claude prepends to compaction summary automatically
    """
    current_session_id = body.session_id
    session_assistant_text: list[str] = []
    obs_count = 0   # STM tool_use observation counter for this turn
    got_result = False
    try:
        triage = await _triage.analyze(body.message)

        # Inject Chiron MCP when user is authenticated and workspace is set.
        if chiron_token and chiron_workspace_id:
            from dataclasses import replace as dc_replace

            from app.core.config import settings as _settings

            chiron_url = f"{_settings.CHIRON_MCP_BASE_URL}/chiron/mcp"
            chiron_mcp = {
                "chiron": {
                    "url": chiron_url,
                    "headers": {"x-mcp-token": chiron_token},
                }
            }
            chiron_tools = [
                "mcp__chiron__read_wiki_index",
                "mcp__chiron__list_wiki_pages",
                "mcp__chiron__read_wiki_page",
                "mcp__chiron__search_wiki",
                "mcp__chiron__list_sources",
                "mcp__chiron__get_source",
                "mcp__chiron__get_source_outline",
                "mcp__chiron__get_source_pages",
                "mcp__chiron__edit_wiki_page",
                "mcp__chiron__propose_wiki_edit",
                "mcp__chiron__list_pending_drafts",
                "mcp__chiron__approve_draft",
                "mcp__chiron__reject_draft",
                "mcp__chiron__list_knowledge_types",
            ]
            merged_servers = {**triage.mcp_servers, **chiron_mcp}
            merged_tools = list(triage.allowed_tools) + [
                t for t in chiron_tools if t not in triage.allowed_tools
            ]
            triage = dc_replace(triage, mcp_servers=merged_servers, allowed_tools=merged_tools)

        logger.info(
            "Chat stream session=%s mode=%s skills=%s tools=%d workspace=%s chiron=%s",
            current_session_id or "new",
            body.permission_mode,
            triage.skills,
            len(triage.allowed_tools),
            workspace_path or "(none)",
            bool(chiron_token),
        )

        # Pre-session context injection — strategy differs for new vs resumed sessions.
        system_prompt: str | None = None
        if body.message:
            parts: list[str] = []

            if not body.session_id:
                # ── New session ──────────────────────────────────────────────
                # Inject all tiers: workspace stack (0), recent activity (1),
                # and cross-session LTM recall (2).
                if tier0_context:
                    parts.append(tier0_context)
                if tier1_context:
                    parts.append(tier1_context)
                tier2 = await memory_svc.recall_context(body.message)
                if tier2:
                    parts.append(tier2)
                logger.debug(
                    "New session context: tier0=%s tier1=%s ltm=%s",
                    bool(tier0_context),
                    bool(tier1_context),
                    bool(tier2),
                )
            else:
                # ── Resume session (Layer 2) ──────────────────────────────────
                # Claude's context window may have been compacted; re-inject the
                # session's own observations from argomemory so Claude remembers
                # what it did in prior turns without relying on its native memory.
                if tier0_context:
                    parts.append(tier0_context)
                if tier1_context:
                    parts.append(tier1_context)
                stm_ctx = await memory_svc.get_session_context(
                    body.session_id,
                    project=project_name_from_path(workspace_path),
                )
                if stm_ctx:
                    parts.append(stm_ctx)
                logger.debug(
                    "Resume session context: tier0=%s tier1=%s stm=%s",
                    bool(tier0_context),
                    bool(tier1_context),
                    bool(stm_ctx),
                )

            if parts:
                system_prompt = "\n\n".join(parts)
                logger.debug("Injecting %d chars system context", len(system_prompt))

        async for event in run_session(
            body.message,
            triage,
            session_id=body.session_id,
            permission_mode=body.permission_mode,
            system_prompt=system_prompt,
            workspace_path=workspace_path,
        ):
            if event.session_id:
                current_session_id = event.session_id

            # ── system:init — session ID is now known ───────────────────────
            if event.type == "system" and event.subtype == "init" and event.session_id:
                # Link the change log entry (existing behaviour).
                if change_log_id:
                    task = asyncio.create_task(
                        _update_change_log_session(change_log_id, event.session_id)
                    )
                    _bg_tasks.add(task)
                    task.add_done_callback(_bg_tasks.discard)

                # Layer 1 — register session in argomemory STM.
                task = asyncio.create_task(
                    memory_svc.start_session(
                        event.session_id,
                        project=project_name_from_path(workspace_path),
                        cwd=workspace_path or "",
                    )
                )
                _bg_tasks.add(task)
                task.add_done_callback(_bg_tasks.discard)

            # ── tool_use — record to STM (Layer 1) ──────────────────────────
            if event.type == "tool_use" and current_session_id and obs_count < _MAX_OBS_PER_SESSION:
                tool_use = event.data.get("tool_use") or {}
                tool_name: str = tool_use.get("name", "")
                tool_input: Any = tool_use.get("input", {})
                # Truncate string values to keep payloads small.
                if isinstance(tool_input, dict):
                    tool_input = {
                        k: (v[:300] if isinstance(v, str) else v)
                        for k, v in tool_input.items()
                    }
                task = asyncio.create_task(
                    memory_svc.observe(
                        current_session_id,
                        "post_tool_use",
                        {"tool_name": tool_name, "tool_input": tool_input},
                    )
                )
                _bg_tasks.add(task)
                task.add_done_callback(_bg_tasks.discard)
                obs_count += 1

            if event.type == "assistant" and event.text:
                session_assistant_text.append(event.text)

            payload = _normalize_event(event, current_session_id)
            if payload is not None:
                yield _sse(payload)

            if event.type == "result":
                got_result = True
                if session_assistant_text:
                    task = asyncio.create_task(
                        _save_session_memory(
                            session_id=current_session_id,
                            user_message=body.message or "(session confirmed)",
                            assistant_chunks=session_assistant_text,
                            workspace_path=workspace_path,
                        )
                    )
                    _bg_tasks.add(task)
                    task.add_done_callback(_bg_tasks.discard)
                break

            if request is not None and await request.is_disconnected():
                logger.info("Client disconnected — aborting session %s", current_session_id)
                break

        if not got_result:
            logger.warning("Claude CLI session %s ended without a result event", current_session_id)
            yield _sse({"type": "error", "message": "Claude session ended unexpectedly. Ensure Claude CLI is installed and authenticated."})

    except asyncio.CancelledError:
        logger.info("SSE stream cancelled for session %s", current_session_id)
    except Exception as exc:
        logger.exception("Chat stream error: %s", exc)
        yield _sse({"type": "error", "message": str(exc)})
    finally:
        yield _sse({"type": "done"})


# ---------------------------------------------------------------------------
# Background helpers
# ---------------------------------------------------------------------------


async def _get_tier0_context(workspace: Any, query: str, db: Any) -> str | None:
    """Build Tier 0 context: workspace stack detection + Chiron wiki semantic search."""
    try:
        return await build_context_injection(
            query=query,
            workspace_id=workspace.id,
            workspace_name=workspace.name,
            workspace_path=workspace.path,
            workspace_description=workspace.description,
            db=db,
        )
    except Exception as exc:
        logger.debug("Tier 0 context injection failed (non-fatal): %s", exc)
        return None


async def _get_tier1_context(workspace_id: UUID, db: Any) -> str | None:
    """Build Tier 1 context string from the 3 most recent change_log entries."""
    try:
        entries = await ChangeLogService(db).list(workspace_id, limit=3)
        if not entries:
            return None
        lines = ["Recent workspace activity:"]
        for e in entries:
            ts = e.created_at.strftime("%Y-%m-%d %H:%M") if e.created_at else ""
            lines.append(f"- [{ts}] {e.prompt[:200]} (status: {e.status})")
        return "\n".join(lines)
    except Exception as exc:
        logger.debug("Tier 1 context lookup failed (non-fatal): %s", exc)
        return None


async def _update_change_log_session(log_id: UUID, session_id: str) -> None:
    """Attach the Claude session_id to the change log entry (best-effort)."""
    from app.db.session import get_db_context

    try:
        async with get_db_context() as db:
            from sqlalchemy import select

            from app.db.models.change_log import ChangeLog

            result = await db.execute(select(ChangeLog).where(ChangeLog.id == log_id))
            entry = result.scalar_one_or_none()
            if entry:
                entry.session_id = session_id
                await db.flush()
    except Exception as exc:
        logger.debug("change_log session update failed (non-fatal): %s", exc)


async def _save_session_memory(
    session_id: str | None,
    user_message: str,
    assistant_chunks: list[str],
    workspace_path: str | None = None,
) -> None:
    """Best-effort post-session memory pipeline (Layer 1 STM close + LTM write).

    Order matters:
      1. Observe the conversation exchange → final STM observation
      2. end_session → mark session completed in argomemory KV
      3. summarize_session → LLM generates SessionSummary (episodic memory)
      4. save_insight → raw LTM write (fast, no LLM)
      5. reflect → LLM extracts lessons → LTM (promotes episodic → semantic)
    """
    assistant_reply = "".join(assistant_chunks)

    # 1. Record the conversation exchange as a final STM observation.
    if session_id:
        await memory_svc.observe(
            session_id,
            "prompt_submit",
            {
                "user_message": user_message[:400],
                "assistant_response": assistant_reply[:800] if assistant_reply else "",
            },
        )

    # 2+3. Close the session and generate episodic memory from all observations.
    if session_id:
        await memory_svc.end_session(session_id)
        await memory_svc.summarize_session(session_id)

    # 4+5. Write LTM insight and reflect to extract persistent lessons.
    summary = f"User asked: {user_message[:300]}"
    if assistant_reply:
        summary += f"\nClaude replied: {assistant_reply[:500]}"
    await memory_svc.save_insight(
        content=summary,
        memory_type="fact",
        concepts=_extract_concepts(user_message),
    )
    await memory_svc.reflect(summary)


def _extract_concepts(text: str) -> list[str]:
    """Quick keyword extraction — no ML, just tokenise and deduplicate."""
    stop = {"the", "a", "an", "is", "in", "to", "of", "and", "or", "it", "for", "with", "how"}
    words = [w.lower().strip(".,?!\"'()[]") for w in text.split() if len(w) > 3]
    seen: set[str] = set()
    concepts: list[str] = []
    for w in words:
        if w not in stop and w not in seen:
            seen.add(w)
            concepts.append(w)
        if len(concepts) == 8:
            break
    return concepts


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/stream")
@limiter.limit("20/minute")
async def chat_stream(
    body: ChatStreamRequest,
    request: Request,
    db: DBSession,
    current_user: OptionalCurrentUser,
) -> StreamingResponse:
    """Start or resume a Claude CLI session and stream events back via SSE."""
    workspace_path: str | None = None
    change_log_id: UUID | None = None
    tier0_context: str | None = None
    tier1_context: str | None = None
    chiron_token: str | None = current_user.mcp_token if current_user else None
    chiron_workspace_id: str | None = str(body.workspace_id) if body.workspace_id else None

    if body.workspace_id:
        try:
            ws = await WorkspaceService(db).get(body.workspace_id)
            workspace_path = ws.path
            # Record the change log entry upfront so it can be linked to session_id later.
            if body.message:
                entry = await ChangeLogService(db).record(
                    workspace_id=body.workspace_id,
                    prompt=body.message,
                )
                change_log_id = entry.id
            # Tier 0: workspace stack + Chiron wiki pages relevant to the query
            if body.message:
                tier0_context = await _get_tier0_context(ws, body.message, db)
            # Tier 1: inject recent activity from this workspace
            tier1_context = await _get_tier1_context(body.workspace_id, db)
        except Exception as exc:
            logger.warning("workspace lookup failed for %s: %s", body.workspace_id, exc)

    return StreamingResponse(
        _stream_response(
            body,
            request,
            workspace_path,
            change_log_id,
            chiron_token=chiron_token,
            chiron_workspace_id=chiron_workspace_id,
            tier0_context=tier0_context,
            tier1_context=tier1_context,
        ),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.post("/confirm")
@limiter.limit("20/minute")
async def chat_confirm(request: Request, body: ChatConfirmRequest) -> StreamingResponse:
    """Resume a plan-mode session in auto mode (user confirmed the plan)."""
    # Re-use the workspace path stored when the session was originally started.
    workspace_path = get_session_workspace(body.session_id)

    stream_body = ChatStreamRequest(
        message="",
        session_id=body.session_id,
        workspace_id=body.workspace_id,
        permission_mode="auto",
    )
    return StreamingResponse(
        _stream_response(
            stream_body, request=None, workspace_path=workspace_path, change_log_id=None
        ),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.delete("/{session_id}")
async def chat_cancel(session_id: str, _: ValidAPIKey) -> dict[str, Any]:
    """Cancel an in-flight session."""
    found = await cancel_session(session_id)
    return {"cancelled": found, "session_id": session_id}


@router.get("/sessions")
async def list_sessions(_: ValidAPIKey) -> dict[str, Any]:
    """List currently active session IDs (debug/admin)."""
    return {"active": active_session_ids()}
