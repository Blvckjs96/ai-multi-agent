"""Active chat session registry for Argo.

Tracks one ClaudeCliSession per session_id while it is actively streaming.
Allows cancellation from a separate HTTP call (e.g. a cancel button).

Only in-flight sessions are stored here — once the SSE stream ends, the entry
is removed automatically. Completed session_ids live only in the frontend.

workspace_path is stored alongside each session so that /chat/confirm can
re-use the same working directory without a DB round-trip.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass

from app.services.claude_cli import ClaudeCliSession, CLIEvent, TriageResult

logger = logging.getLogger(__name__)


@dataclass
class _SessionEntry:
    session: ClaudeCliSession
    workspace_path: str | None


# session_id → active entry
_active: dict[str, _SessionEntry] = {}


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
        ):
            # Register as soon as we know the session_id
            if session.session_id and session.session_id not in _active:
                registered_id = session.session_id
                _active[registered_id] = _SessionEntry(
                    session=session,
                    workspace_path=workspace_path,
                )
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
    """Return the workspace_path registered for *session_id*, or None."""
    entry = _active.get(session_id)
    return entry.workspace_path if entry else None


def active_session_ids() -> list[str]:
    return list(_active.keys())
