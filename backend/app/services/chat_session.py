"""Active chat session registry for Argo.

Tracks one session per session_id while it is actively streaming.
Allows cancellation from a separate HTTP call (e.g. a cancel button).

Only in-flight sessions are stored here — once the SSE stream ends, the entry
is removed automatically. Completed session_ids live only in the frontend.

workspace_path is stored alongside each session so that /chat/confirm can
re-use the same working directory without a DB round-trip.

Routing:
    route_session() selects between ClaudeCliSession (cloud) and
    OllamaCodeSession (local) based on ROUTING_MODE + live connectivity probes.
    The decision is logged but transparent to callers — both yield CLIEvent.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Union

from app.services.claude_cli import ClaudeCliSession, CLIEvent, TriageResult
from app.services.connectivity import routing_decision
from app.services.ollama_session import OllamaCodeSession

logger = logging.getLogger(__name__)


@dataclass
class _SessionEntry:
    session: Union[ClaudeCliSession, OllamaCodeSession]
    workspace_path: str | None


# session_id → active entry
_active: dict[str, _SessionEntry] = {}

# session_id → workspace_path, persisted after session ends so /confirm can
# resume the plan subprocess in the correct project directory.  Consumed (popped)
# once retrieved, so it doesn't grow unboundedly.
_plan_workspaces: dict[str, str | None] = {}


async def run_session(
    message: str,
    triage: TriageResult,
    *,
    session_id: str | None = None,
    permission_mode: str = "plan",
    system_prompt: str | None = None,
    workspace_path: str | None = None,
) -> AsyncIterator[CLIEvent]:
    """Spawn a ClaudeCliSession, register it, and yield events.

    The session is de-registered as soon as the stream ends or is cancelled.
    workspace_path sets the subprocess cwd so Claude operates inside the repo.
    """
    session = ClaudeCliSession()
    registered_id: str | None = session_id  # may be updated once init fires

    try:
        async for event in session.start(
            message,
            triage,
            permission_mode=permission_mode,
            session_id=session_id,
            system_prompt=system_prompt,
            cwd=workspace_path,
            user_model=user_model,
        ):
            # Register as soon as we know the session_id
            if session.session_id and session.session_id not in _active:
                registered_id = session.session_id
                _active[registered_id] = _SessionEntry(
                    session=session,
                    workspace_path=workspace_path,
                )
                _plan_workspaces[registered_id] = workspace_path
                logger.debug("Registered active session %s (cwd=%s)", registered_id, workspace_path)

            yield event

            if event.type == "result":
                break
    finally:
        if registered_id and registered_id in _active:
            del _active[registered_id]
            logger.debug("Removed active session %s", registered_id)
        await session.terminate()


async def cancel_session(session_id: str) -> bool:
    """Terminate an active session. Returns True if the session was found."""
    entry = _active.pop(session_id, None)
    if entry is None:
        return False
    await entry.session.terminate()
    logger.info("Cancelled session %s", session_id)
    return True


def get_session_workspace(session_id: str) -> str | None:
    """Return the workspace_path registered for *session_id*, or None.

    Checks the active registry first, then falls back to the persisted plan
    workspace (consumed on read so the dict doesn't grow unboundedly).
    """
    entry = _active.get(session_id)
    if entry:
        return entry.workspace_path
    return _plan_workspaces.pop(session_id, None)


def active_session_ids() -> list[str]:
    return list(_active.keys())


# ---------------------------------------------------------------------------
# Local session runner (OllamaCodeSession)
# ---------------------------------------------------------------------------


async def run_local_session(
    message: str,
    triage: TriageResult,
    *,
    session_id: str | None = None,
    permission_mode: str = "auto",   # local always auto — no plan gate
    system_prompt: str | None = None,
    workspace_path: str | None = None,
    user_model: str | None = None,
) -> AsyncIterator[CLIEvent]:
    """Spawn an OllamaCodeSession, register it, and yield CLIEvents.

    Mirrors run_session() so callers can treat both interchangeably.
    """
    session = OllamaCodeSession()
    registered_id: str | None = session_id

    try:
        async for event in session.start(
            message,
            triage,
            permission_mode=permission_mode,
            session_id=session_id,
            system_prompt=system_prompt,
            cwd=workspace_path,
            user_model=user_model,
        ):
            if session.session_id and session.session_id not in _active:
                registered_id = session.session_id
                _active[registered_id] = _SessionEntry(
                    session=session,
                    workspace_path=workspace_path,
                )
                _plan_workspaces[registered_id] = workspace_path
                logger.debug("Registered local session %s (cwd=%s)", registered_id, workspace_path)

            yield event

            if event.type == "result":
                break
    finally:
        if registered_id and registered_id in _active:
            del _active[registered_id]
            logger.debug("Removed local session %s", registered_id)
        await session.terminate()


# ---------------------------------------------------------------------------
# Routing dispatcher — selects cloud or local transparently
# ---------------------------------------------------------------------------


async def route_session(
    message: str,
    triage: TriageResult,
    *,
    session_id: str | None = None,
    permission_mode: str = "plan",
    system_prompt: str | None = None,
    workspace_path: str | None = None,
    user_model: str | None = None,
) -> AsyncIterator[CLIEvent]:
    """Route to ClaudeCliSession (cloud) or OllamaCodeSession (local).

    Decision is based on ROUTING_MODE env var + live connectivity probes:
      force_cloud   → always Claude CLI
      force_local   → always Ollama
      prefer_cloud  → Claude if online, else Ollama
      prefer_local  → Ollama if online, else Claude
      auto (default)→ Claude for write tasks when online; Ollama for read/Q&A
    """
    decision = await routing_decision(triage)
    logger.info(
        "route_session: backend=%s session=%s tools=%d",
        decision,
        session_id[:8] if session_id else "new",
        len(triage.allowed_tools),
    )

    if decision == "claude":
        async for event in run_session(
            message,
            triage,
            session_id=session_id,
            permission_mode=permission_mode,
            system_prompt=system_prompt,
            workspace_path=workspace_path,
        ):
            yield event
    else:
        async for event in run_local_session(
            message,
            triage,
            session_id=session_id,
            permission_mode="auto",   # local never needs plan-gate confirmation
            system_prompt=system_prompt,
            workspace_path=workspace_path,
            user_model=user_model,
        ):
            yield event
