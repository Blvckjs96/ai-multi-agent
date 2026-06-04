"""Tool executor for the local AI agent (OllamaCodeSession).

Implements the six core Claude Code tools that a local model can call:
    Read, Write, Edit, Bash, Grep, Glob

Design principles:
  - Never crash the agent loop: every execution returns a string (never raises).
  - Explicit guards against context explosion, infinite loops, and destructive ops.
  - Tool name normalisation handles LLM hallucinations (wrong casing / underscores).
  - All filesystem writes are restricted to `cwd` when provided.
  - Bash execution is sandboxed: timeout + output cap + blocked patterns.
"""

from __future__ import annotations

import asyncio
import glob
import json
import logging
import re
from asyncio import subprocess as asubprocess
from collections import Counter
from pathlib import Path
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Guards
# ---------------------------------------------------------------------------

MAX_READ_SIZE_BYTES   = 100_000    # skip files larger than this
MAX_BASH_OUTPUT_CHARS = 8_000      # truncate long command output
MAX_GLOB_RESULTS      = 50         # cap glob matches returned to model
BASH_TIMEOUT_DEFAULT  = 30         # seconds
BASH_TIMEOUT_MAX      = 60         # hard ceiling regardless of model request

# Patterns that would be dangerous to execute in an automated context.
_BLOCKED_BASH_RE = re.compile(
    r"rm\s+-[rRf]{1,3}[f]?\s*/|"   # rm -rf /...
    r"\brm\s+--no-preserve-root|"
    r"\bdd\s+if=|"
    r"\bmkfs\b|"
    r"\bformat\s+[A-Za-z]:|"
    r"\bsudo\b|"
    r"\bsu\s+-|"
    r":\(\)\{.*\}\s*;|"             # fork bomb
    r"\bchmod\s+777\s+/|"
    r"\bchown\s+.*\s+/",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# JSON Schemas (sent to Ollama as the `tools` parameter)
# ---------------------------------------------------------------------------

TOOL_SCHEMAS: dict[str, dict[str, Any]] = {
    "Read": {
        "type": "function",
        "function": {
            "name": "Read",
            "description": "Read the contents of a file. Returns the file content as a string.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Absolute path to the file to read.",
                    }
                },
                "required": ["file_path"],
            },
        },
    },
    "Write": {
        "type": "function",
        "function": {
            "name": "Write",
            "description": "Write content to a file, creating it if it does not exist.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Absolute path to the file."},
                    "content": {"type": "string", "description": "Content to write."},
                },
                "required": ["file_path", "content"],
            },
        },
    },
    "Edit": {
        "type": "function",
        "function": {
            "name": "Edit",
            "description": (
                "Replace an exact string in a file. "
                "`old_string` must match exactly (including whitespace). "
                "Use Read first to see current content."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string"},
                    "old_string": {"type": "string", "description": "Exact text to replace."},
                    "new_string": {"type": "string", "description": "Replacement text."},
                },
                "required": ["file_path", "old_string", "new_string"],
            },
        },
    },
    "Bash": {
        "type": "function",
        "function": {
            "name": "Bash",
            "description": (
                "Execute a shell command and return its output. "
                "Avoid destructive commands (rm -rf, sudo, dd, mkfs). "
                "Output is truncated at 8000 characters."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "Shell command to run."},
                    "timeout": {
                        "type": "integer",
                        "description": f"Timeout in seconds (max {BASH_TIMEOUT_MAX}).",
                        "default": BASH_TIMEOUT_DEFAULT,
                    },
                },
                "required": ["command"],
            },
        },
    },
    "Grep": {
        "type": "function",
        "function": {
            "name": "Grep",
            "description": "Search for a pattern in files using grep.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "Regex or literal search pattern."},
                    "path": {"type": "string", "description": "Directory or file path to search in."},
                    "include": {"type": "string", "description": "File glob filter, e.g. '*.py'."},
                    "case_sensitive": {"type": "boolean", "default": True},
                },
                "required": ["pattern"],
            },
        },
    },
    "Glob": {
        "type": "function",
        "function": {
            "name": "Glob",
            "description": "Find files matching a glob pattern.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {
                        "type": "string",
                        "description": "Glob pattern, e.g. 'src/**/*.py'.",
                    },
                    "path": {
                        "type": "string",
                        "description": "Base directory (defaults to cwd).",
                    },
                },
                "required": ["pattern"],
            },
        },
    },
}


# ---------------------------------------------------------------------------
# Tool name normalisation
# ---------------------------------------------------------------------------

_ALIASES: dict[str, str] = {
    # Read variants
    "read": "Read", "read_file": "Read", "readfile": "Read",
    "cat": "Read", "open": "Read", "view": "Read",
    # Write variants
    "write": "Write", "write_file": "Write", "writefile": "Write",
    "create_file": "Write", "save": "Write",
    # Edit variants
    "edit": "Edit", "edit_file": "Edit", "editfile": "Edit",
    "str_replace": "Edit", "replace": "Edit", "patch": "Edit",
    "str_replace_based_edit_tool": "Edit",
    # Bash variants
    "bash": "Bash", "shell": "Bash", "run": "Bash",
    "run_command": "Bash", "execute": "Bash", "cmd": "Bash",
    # Grep variants
    "grep": "Grep", "search": "Grep", "search_text": "Grep",
    "search_in_files": "Grep", "find_text": "Grep",
    # Glob variants
    "glob": "Glob", "find": "Glob", "find_files": "Glob",
    "list_files": "Glob", "ls": "Glob",
}


def normalize_tool_name(name: str) -> str | None:
    """Return canonical tool name or None if unrecognised."""
    # Exact match first (case-sensitive)
    if name in TOOL_SCHEMAS:
        return name
    # Normalise: lowercase, collapse separators
    key = re.sub(r"[-\s]+", "_", name.lower())
    canonical = _ALIASES.get(key)
    if canonical:
        return canonical
    # Prefix match as last resort: "ReadFileTool" → "read_file_tool" → "read" → "Read"
    for alias, canon in _ALIASES.items():
        if key.startswith(alias):
            return canon
    return None


# ---------------------------------------------------------------------------
# Loop guard
# ---------------------------------------------------------------------------


class ToolLoopGuard:
    """Detect and break infinite or repetitive tool call loops."""

    def __init__(self, max_iterations: int | None = None) -> None:
        self._max = max_iterations or settings.LOCAL_MAX_TOOL_ITERATIONS
        self._count = 0
        self._call_counts: Counter[str] = Counter()

    def check(self, tool_name: str, arguments: dict[str, Any]) -> bool:
        """Return True if the loop should continue; False if it should stop."""
        self._count += 1
        if self._count > self._max:
            logger.warning("ToolLoopGuard: max iterations %d reached", self._max)
            return False

        key = f"{tool_name}:{json.dumps(arguments, sort_keys=True, default=str)}"
        self._call_counts[key] += 1
        if self._call_counts[key] >= 3:
            logger.warning(
                "ToolLoopGuard: tool call repeated 3×: %s — breaking loop", tool_name
            )
            return False
        return True

    @property
    def iteration(self) -> int:
        return self._count


# ---------------------------------------------------------------------------
# Main dispatcher
# ---------------------------------------------------------------------------


async def execute_tool(
    name: str,
    arguments: dict[str, Any],
    *,
    cwd: str | None = None,
) -> str:
    """Execute a tool call and return its output as a string.

    Never raises — all errors are returned as an error string so the agent
    loop can forward the message back to the model for correction.
    """
    canonical = normalize_tool_name(name)
    if canonical is None:
        available = ", ".join(sorted(TOOL_SCHEMAS))
        return (
            f"[ToolError: unknown tool '{name}'. "
            f"Available tools: {available}]"
        )

    try:
        match canonical:
            case "Read":
                return await _exec_read(arguments, cwd)
            case "Write":
                return await _exec_write(arguments, cwd)
            case "Edit":
                return await _exec_edit(arguments, cwd)
            case "Bash":
                return await _exec_bash(arguments, cwd)
            case "Grep":
                return await _exec_grep(arguments, cwd)
            case "Glob":
                return await _exec_glob(arguments, cwd)
            case _:
                return f"[ToolError: unhandled canonical tool '{canonical}']"
    except Exception as exc:
        logger.exception("execute_tool(%s) raised unexpectedly: %s", canonical, exc)
        return f"[ToolError: {canonical} raised {type(exc).__name__}: {exc}]"


# ---------------------------------------------------------------------------
# Individual tool implementations
# ---------------------------------------------------------------------------


async def _exec_read(arguments: dict[str, Any], cwd: str | None) -> str:
    file_path = arguments.get("file_path") or arguments.get("path") or ""
    if not file_path:
        return "[ToolError: Read requires 'file_path']"

    path = _resolve_path(file_path, cwd)
    if not path.exists():
        return f"[ToolError: file not found: {path}]"
    if not path.is_file():
        return f"[ToolError: path is not a file: {path}]"

    size = path.stat().st_size
    if size > MAX_READ_SIZE_BYTES:
        return (
            f"[ToolWarning: file too large ({size:,} bytes > {MAX_READ_SIZE_BYTES:,}). "
            f"Use Grep or Glob to locate specific sections.]"
        )

    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        return f"[ToolError: cannot read {path}: {exc}]"


async def _exec_write(arguments: dict[str, Any], cwd: str | None) -> str:
    file_path = arguments.get("file_path") or arguments.get("path") or ""
    content = arguments.get("content", "")
    if not file_path:
        return "[ToolError: Write requires 'file_path']"

    path = _resolve_path(file_path, cwd)
    _assert_within_cwd(path, cwd)

    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return f"[OK: wrote {len(content)} chars to {path}]"
    except OSError as exc:
        return f"[ToolError: cannot write {path}: {exc}]"


async def _exec_edit(arguments: dict[str, Any], cwd: str | None) -> str:
    file_path = arguments.get("file_path") or arguments.get("path") or ""
    old_string = arguments.get("old_string", "")
    new_string = arguments.get("new_string", "")

    if not file_path:
        return "[ToolError: Edit requires 'file_path']"
    if not old_string:
        return "[ToolError: Edit requires 'old_string']"

    path = _resolve_path(file_path, cwd)
    _assert_within_cwd(path, cwd)

    if not path.exists():
        return f"[ToolError: file not found: {path}]"

    try:
        original = path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        return f"[ToolError: cannot read {path}: {exc}]"

    if old_string not in original:
        # Give model a diff-like hint so it can self-correct.
        preview = original[:500] + ("…" if len(original) > 500 else "")
        return (
            f"[ToolError: 'old_string' not found in {path}. "
            f"Use Read first to see current content.]\n"
            f"File starts with:\n{preview}"
        )

    count = original.count(old_string)
    if count > 1:
        return (
            f"[ToolError: 'old_string' appears {count} times in {path}. "
            f"Provide more surrounding context to make it unique.]"
        )

    updated = original.replace(old_string, new_string, 1)
    try:
        path.write_text(updated, encoding="utf-8")
        return f"[OK: edited {path} — replaced 1 occurrence]"
    except OSError as exc:
        return f"[ToolError: cannot write {path}: {exc}]"


async def _exec_bash(arguments: dict[str, Any], cwd: str | None) -> str:
    raw_command = arguments.get("command", "")
    # Guard: model sometimes passes the schema dict instead of a string value.
    if not isinstance(raw_command, str):
        return (
            f"[ToolError: Bash 'command' must be a string, got {type(raw_command).__name__}. "
            f"Example: {{\"command\": \"ls -la\"}}]"
        )
    command = raw_command.strip()
    if not command:
        return "[ToolError: Bash requires 'command']"

    # Safety check
    if _BLOCKED_BASH_RE.search(command):
        return (
            f"[ToolError: command blocked by safety policy. "
            f"Dangerous patterns (rm -rf /, sudo, dd, mkfs, fork bomb) are not allowed.]"
        )

    timeout = min(
        int(arguments.get("timeout", BASH_TIMEOUT_DEFAULT)),
        BASH_TIMEOUT_MAX,
    )

    try:
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asubprocess.PIPE,
            stderr=asubprocess.PIPE,
            cwd=cwd,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except Exception:
            pass
        return f"[ToolError: command timed out after {timeout}s: {command[:120]}]"
    except Exception as exc:
        return f"[ToolError: Bash failed to start: {exc}]"

    raw = (stdout + stderr).decode(errors="replace")
    if len(raw) > MAX_BASH_OUTPUT_CHARS:
        raw = raw[:MAX_BASH_OUTPUT_CHARS] + f"\n… [output truncated, {len(raw):,} chars total]"
    return raw or "(no output)"


async def _exec_grep(arguments: dict[str, Any], cwd: str | None) -> str:
    pattern = arguments.get("pattern", "")
    search_path = arguments.get("path", cwd or ".")
    include = arguments.get("include", "")
    case_sensitive = arguments.get("case_sensitive", True)

    if not pattern:
        return "[ToolError: Grep requires 'pattern']"

    flags = [] if case_sensitive else ["-i"]
    include_flags = ["--include", include] if include else []

    cmd = ["grep", "-rn", "--color=never", *flags, *include_flags, pattern, search_path]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asubprocess.PIPE,
            stderr=asubprocess.PIPE,
            cwd=cwd,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=15)
    except asyncio.TimeoutError:
        return "[ToolError: Grep timed out after 15s]"
    except Exception as exc:
        return f"[ToolError: Grep failed: {exc}]"

    result = stdout.decode(errors="replace")
    if len(result) > MAX_BASH_OUTPUT_CHARS:
        result = result[:MAX_BASH_OUTPUT_CHARS] + "\n… [truncated]"
    return result or "(no matches)"


async def _exec_glob(arguments: dict[str, Any], cwd: str | None) -> str:
    pattern = arguments.get("pattern", "")
    base = arguments.get("path", cwd or ".")

    if not pattern:
        return "[ToolError: Glob requires 'pattern']"

    # If pattern is absolute, ignore base.
    if Path(pattern).is_absolute():
        full_pattern = pattern
    else:
        full_pattern = str(Path(base) / pattern)

    try:
        matches = glob.glob(full_pattern, recursive=True)
    except Exception as exc:
        return f"[ToolError: Glob failed: {exc}]"

    matches = matches[:MAX_GLOB_RESULTS]
    if not matches:
        return "(no files matched)"
    return "\n".join(sorted(matches))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _resolve_path(file_path: str, cwd: str | None) -> Path:
    p = Path(file_path)
    if p.is_absolute():
        return p
    if cwd:
        return Path(cwd) / p
    return p.resolve()


def _assert_within_cwd(path: Path, cwd: str | None) -> None:
    """Raise ValueError if path escapes cwd (path traversal guard)."""
    if cwd is None:
        return
    try:
        path.resolve().relative_to(Path(cwd).resolve())
    except ValueError:
        raise ValueError(
            f"Path '{path}' is outside the workspace '{cwd}'. "
            "Write/Edit operations are restricted to the workspace directory."
        )
