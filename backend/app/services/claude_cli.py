"""Claude Code CLI subprocess manager (Argo).

Wraps the `claude` binary as an async subprocess and exposes a streaming
interface that yields parsed stream-json events. This is the primary AI
execution engine for Argo — it uses the user's Pro/Max subscription instead
of API credits.

Usage:
    session = ClaudeCliSession()
    triage = TriageResult(allowed_tools=["Read", "Write", "Edit"])
    async for event in session.start("Create a login form", triage):
        if event.type == "assistant" and event.text:
            print(event.text, end="", flush=True)
        elif event.type == "result":
            print("\\nDone. Session:", event.session_id)

    # Resume the same session later
    session2 = ClaudeCliSession()
    async for event in session2.start("Add validation", triage, session_id=session.session_id):
        ...

Stream-JSON event types emitted by the CLI:
    system/init    Session started — contains session_id
    assistant      Text or thinking tokens (streaming)
    tool_use       A tool is being called
    tool_result    Tool response received
    result         Session complete — contains usage, cost, session_id
    rate_limit_event Near rate limit warning
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------


@dataclass
class TriageResult:
    """Output from the triage system that shapes the Claude CLI invocation."""

    allowed_tools: list[str] = field(
        default_factory=lambda: [
            "Read",
            "Write",
            "Edit",
            "Bash",
            "Grep",
            "Glob",
            "WebSearch",
        ]
    )
    mcp_servers: dict[str, Any] = field(default_factory=dict)
    skills: list[str] = field(default_factory=list)
    model: str = "sonnet"
    effort: str = "normal"


@dataclass
class CLIEvent:
    """A parsed event from the Claude CLI stream-json output."""

    type: str  # "system", "assistant", "tool_use", "tool_result", "result", "rate_limit_event"
    subtype: str | None  # assistant: "text" | "thinking" | None; system: "init"
    data: dict[str, Any]  # raw JSON payload
    session_id: str | None = None
    text: str | None = None  # convenience: extracted text for assistant text events


# ---------------------------------------------------------------------------
# Session
# ---------------------------------------------------------------------------


class ClaudeCliSession:
    """Manages a single Claude Code CLI subprocess."""

    def __init__(self) -> None:
        self.session_id: str | None = None
        self._process: asyncio.subprocess.Process | None = None

    # --- public interface ---

    async def start(
        self,
        message: str,
        triage: TriageResult,
        *,
        permission_mode: str = "plan",
        session_id: str | None = None,
        system_prompt: str | None = None,
        cwd: str | None = None,
    ) -> AsyncIterator[CLIEvent]:
        """Spawn Claude CLI, send the first message, and stream events.

        Args:
            message: The user's message (skills from triage are prepended).
            triage: Routing metadata — tools, MCPs, model, effort.
            permission_mode: "plan" (default, shows plan before acting) or "auto".
            session_id: Pass a previous session_id to resume an existing session.

        Yields:
            CLIEvent objects as they arrive. self.session_id is populated once
            the system/init event is received.
        """
        cmd = self._build_command(triage, permission_mode, session_id, system_prompt)
        full_message = self._prepend_skills(message, triage.skills)

        logger.info(
            "Starting Claude CLI session (mode=%s, resume=%s, tools=%d, cwd=%s)",
            permission_mode,
            bool(session_id),
            len(triage.allowed_tools),
            cwd or "(default)",
        )

        # Claude CLI ≥2.1.x dropped --input-format stream-json; --print mode reads
        # the message from stdin as plain text (or no stdin for session resume).
        stdin_payload: bytes | None = full_message.encode() if full_message else None

        self._process = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE if stdin_payload else asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
        )

        if stdin_payload is not None:
            if self._process.stdin is None:
                raise RuntimeError("Claude CLI process stdin is not available")
            self._process.stdin.write(stdin_payload)
            await self._process.stdin.drain()
            self._process.stdin.close()
            await self._process.stdin.wait_closed()

        asyncio.create_task(self._drain_stderr())

        async for event in self._read_events():
            yield event

    async def confirm(self, *, permission_mode: str = "auto") -> AsyncIterator[CLIEvent]:
        """After a plan-mode session, confirm and execute.

        Resumes the same session with permission_mode=auto so Claude proceeds.
        """
        if not self.session_id:
            raise RuntimeError("No session_id — cannot confirm without a prior start()")
        triage = TriageResult()  # minimal, session already has context
        async for event in self.start(
            "",
            triage,
            permission_mode=permission_mode,
            session_id=self.session_id,
        ):
            yield event

    async def terminate(self) -> None:
        """Terminate the subprocess if still running."""
        if self._process and self._process.returncode is None:
            self._process.terminate()
            try:
                await asyncio.wait_for(self._process.wait(), timeout=5.0)
            except TimeoutError:
                self._process.kill()

    # --- internal helpers ---

    def _build_command(
        self,
        triage: TriageResult,
        permission_mode: str,
        session_id: str | None,
        system_prompt: str | None = None,
    ) -> list[str]:
        # Merge argomemory MCP globally so Claude can use memory tools in every session.
        mcp_servers = {**triage.mcp_servers}
        allowed_tools = list(triage.allowed_tools)
        if settings.ARGOMEMORY_MCP_PATH and settings.ARGOMEMORY_ENABLED:
            mcp_servers["argomemory"] = {
                "command": "node",
                "args": [settings.ARGOMEMORY_MCP_PATH],
                "env": {
                    "ARGOMEMORY_URL": settings.ARGOMEMORY_URL,
                    "ARGOMEMORY_SECRET": settings.ARGOMEMORY_SECRET,
                },
            }
            # Add core argomemory tools to the allowed set.
            for tool in (
                "mcp__argomemory__memory_recall",
                "mcp__argomemory__memory_save",
                "mcp__argomemory__memory_smart_search",
                "mcp__argomemory__memory_sessions",
            ):
                if tool not in allowed_tools:
                    allowed_tools.append(tool)

        # --print is required for --output-format stream-json to work.
        # --input-format stream-json was removed in Claude CLI ≥2.1.x.
        cmd: list[str] = [
            settings.CLAUDE_CLI_PATH,
            "--print",
            "--output-format",
            "stream-json",
            "--verbose",
            "--include-partial-messages",
            "--allowedTools",
            ",".join(allowed_tools),
            "--model",
            triage.model,
            "--permission-mode",
            permission_mode,
        ]
        # Only include servers that have an actual config (non-empty dict).
        # Triage may return placeholder entries like {"chiron": {}} or
        # {"argomemory": {}} which are filled in later by _stream_response or
        # _build_command itself.  Passing empty configs with --strict-mcp-config
        # causes Claude CLI to fail because there is no command/url to connect to.
        valid_servers = {k: v for k, v in mcp_servers.items() if v}
        if valid_servers:
            mcp_config = json.dumps({"mcpServers": valid_servers})
            cmd += ["--mcp-config", mcp_config, "--strict-mcp-config"]
        if system_prompt:
            cmd += ["--append-system-prompt", system_prompt]
        if session_id:
            cmd += ["--resume", session_id]
        return cmd

    @staticmethod
    def _prepend_skills(message: str, skills: list[str]) -> str:
        """Prepend /skill-name invocations to the message — invisible to the user."""
        if not skills:
            return message
        prefix = "\n".join(f"/{s}" for s in skills)
        return f"{prefix}\n{message}"

    async def _drain_stderr(self) -> None:
        """Read stderr to prevent 64 KB buffer deadlock and surface CLI errors."""
        if self._process is None or self._process.stderr is None:
            return
        try:
            while True:
                line = await self._process.stderr.readline()
                if not line:
                    break
                logger.warning("Claude CLI stderr: %s", line.decode(errors="replace").rstrip())
        except Exception as exc:
            logger.debug("stderr drain ended: %s", exc)

    async def _read_events(self) -> AsyncIterator[CLIEvent]:
        """Read stdout line-by-line, parse stream-json, yield CLIEvents."""
        if self._process is None:
            raise RuntimeError("Claude CLI process is not running")
        if self._process.stdout is None:
            raise RuntimeError("Claude CLI process stdout is not available")

        while True:
            try:
                line = await self._process.stdout.readline()
            except asyncio.CancelledError:
                await self.terminate()
                raise

            if not line:
                break

            line_str = line.decode(errors="replace").strip()
            if not line_str:
                continue

            try:
                raw: dict[str, Any] = json.loads(line_str)
            except json.JSONDecodeError:
                logger.debug("Non-JSON stdout: %s", line_str[:200])
                continue

            event = _parse_event(raw)
            if event is None:
                continue

            # Capture session_id from system/init
            if event.type == "system" and event.subtype == "init":
                sid = raw.get("session_id") or raw.get("data", {}).get("session_id")
                if sid:
                    self.session_id = sid
                    event.session_id = sid

            # Propagate session_id on result events
            if event.type == "result":
                sid = raw.get("session_id")
                if sid:
                    self.session_id = sid
                    event.session_id = sid

            yield event

            if event.type == "result":
                break


# ---------------------------------------------------------------------------
# Event parser
# ---------------------------------------------------------------------------


def _parse_event(raw: dict[str, Any]) -> CLIEvent | None:
    event_type = raw.get("type", "")
    if not event_type:
        return None

    subtype: str | None = raw.get("subtype")
    text: str | None = None

    if event_type == "assistant":
        # Extract text or thinking from content blocks
        message = raw.get("message") or {}
        content = message.get("content", [])
        if isinstance(content, list):
            for block in content:
                if not isinstance(block, dict):
                    continue
                if block.get("type") == "text":
                    text = block.get("text")
                    subtype = "text"
                    break
                if block.get("type") == "thinking":
                    text = block.get("thinking")
                    subtype = "thinking"
                    break
        # Partial message events carry delta directly
        if text is None and raw.get("is_partial"):
            delta = raw.get("delta") or {}
            delta_type = delta.get("type", "text_delta")
            if delta_type == "thinking_delta":
                text = delta.get("thinking")
                subtype = "thinking"
            else:
                text = delta.get("text")
                subtype = "text"

    return CLIEvent(
        type=event_type,
        subtype=subtype,
        data=raw,
        session_id=raw.get("session_id"),
        text=text,
    )
