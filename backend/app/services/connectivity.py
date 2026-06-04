"""Connectivity probes for Claude CLI and Ollama.

Determines whether Claude Code CLI and the local Ollama server are reachable,
then uses that information — combined with ROUTING_MODE — to decide whether a
chat session should run via ClaudeCliSession or OllamaCodeSession.

TTL caches prevent probe latency from blocking every request:
  - Claude probe: 60s TTL  (subprocess `claude --version`)
  - Ollama probe: 30s TTL  (HTTP GET /api/tags)
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import TYPE_CHECKING, Literal

import httpx

from app.core.config import settings

if TYPE_CHECKING:
    from app.services.claude_cli import TriageResult

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# TTL cache state
# ---------------------------------------------------------------------------

_claude_result: bool | None = None
_claude_ts: float = 0.0
_CLAUDE_TTL = 60.0

_ollama_result: bool | None = None
_ollama_ts: float = 0.0
_OLLAMA_TTL = 30.0

# Serialise concurrent probes so only one subprocess/HTTP call fires at a time.
_claude_lock = asyncio.Lock()
_ollama_lock = asyncio.Lock()

# Tools that actually modify files — only these warrant cloud-model preference.
_WRITE_TOOLS: frozenset[str] = frozenset({"Write", "Edit", "MultiEdit", "Bash", "NotebookEdit"})


# ---------------------------------------------------------------------------
# Probes
# ---------------------------------------------------------------------------


async def claude_is_online() -> bool:
    """Return True if `claude --version` exits 0 within 5 seconds.

    Result is cached for CLAUDE_TTL seconds to avoid blocking every request.
    """
    global _claude_result, _claude_ts

    now = time.monotonic()
    if _claude_result is not None and (now - _claude_ts) < _CLAUDE_TTL:
        return _claude_result

    async with _claude_lock:
        # Re-check under lock — another coroutine may have refreshed already.
        now = time.monotonic()
        if _claude_result is not None and (now - _claude_ts) < _CLAUDE_TTL:
            return _claude_result

        try:
            proc = await asyncio.create_subprocess_exec(
                settings.CLAUDE_CLI_PATH,
                "--version",
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            await asyncio.wait_for(proc.wait(), timeout=5.0)
            result = proc.returncode == 0
        except (FileNotFoundError, asyncio.TimeoutError, OSError) as exc:
            logger.debug("Claude CLI probe failed: %s", exc)
            result = False

        _claude_result = result
        _claude_ts = time.monotonic()
        logger.debug("Claude CLI online=%s (cached %ds)", result, int(_CLAUDE_TTL))
        return result


async def ollama_is_online() -> bool:
    """Return True if Ollama's /api/tags endpoint responds within 3 seconds.

    Result is cached for OLLAMA_TTL seconds.
    """
    global _ollama_result, _ollama_ts

    now = time.monotonic()
    if _ollama_result is not None and (now - _ollama_ts) < _OLLAMA_TTL:
        return _ollama_result

    async with _ollama_lock:
        now = time.monotonic()
        if _ollama_result is not None and (now - _ollama_ts) < _OLLAMA_TTL:
            return _ollama_result

        url = f"{settings.OLLAMA_HOST.rstrip('/')}/api/tags"
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(url)
            result = resp.status_code == 200
        except Exception as exc:
            logger.debug("Ollama probe failed: %s", exc)
            result = False

        _ollama_result = result
        _ollama_ts = time.monotonic()
        logger.debug("Ollama online=%s (cached %ds)", result, int(_OLLAMA_TTL))
        return result


# ---------------------------------------------------------------------------
# Routing decision
# ---------------------------------------------------------------------------


async def routing_decision(triage: TriageResult) -> Literal["claude", "ollama"]:
    """Decide which backend to use for this triage result.

    Decision matrix:
      force_local   → ollama  (always, regardless of availability)
      force_cloud   → claude  (always, regardless of availability)
      prefer_local  → ollama if online, else claude
      prefer_cloud  → claude if online, else ollama if online, else claude
      auto          → claude for write tasks when online; ollama for read/Q&A
    """
    mode = settings.ROUTING_MODE

    if mode == "force_local":
        logger.debug("routing: force_local → ollama")
        return "ollama"

    if mode == "force_cloud":
        logger.debug("routing: force_cloud → claude")
        return "claude"

    # Run both probes concurrently to minimise latency.
    c_online, o_online = await asyncio.gather(
        claude_is_online(),
        ollama_is_online(),
    )

    has_write = bool(_WRITE_TOOLS & set(triage.allowed_tools))

    if mode == "prefer_local":
        decision = "ollama" if o_online else "claude"
        logger.info("routing: prefer_local claude=%s ollama=%s → %s", c_online, o_online, decision)
        return decision

    if mode == "prefer_cloud":
        decision = "claude" if c_online else ("ollama" if o_online else "claude")
        logger.info("routing: prefer_cloud claude=%s ollama=%s → %s", c_online, o_online, decision)
        return decision

    # auto: write tasks benefit most from Claude's reliability; read/Q&A → local.
    if has_write and c_online:
        logger.info("routing: auto write_task claude=%s → claude", c_online)
        return "claude"
    if o_online:
        logger.info("routing: auto read_task ollama=%s → ollama", o_online)
        return "ollama"
    logger.info("routing: auto fallback claude=%s ollama=%s → claude", c_online, o_online)
    return "claude"


def invalidate_cache() -> None:
    """Force-expire both probe caches. Useful in tests."""
    global _claude_result, _ollama_result, _claude_ts, _ollama_ts
    _claude_result = None
    _ollama_result = None
    _claude_ts = 0.0
    _ollama_ts = 0.0
