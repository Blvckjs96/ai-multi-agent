"""Desktop app settings — Claude CLI auth status and system info."""

from __future__ import annotations

import asyncio
import platform
import sys
from pathlib import Path
from typing import Any

from fastapi import APIRouter

from app.core.cli_utils import find_binary

router = APIRouter(prefix="/settings", tags=["settings"])

_CLAUDE_DIR = Path.home() / ".claude"


def _detect_claude() -> dict[str, Any]:
    path = find_binary("claude")
    if not path:
        return {"installed": False, "authenticated": False, "path": None, "version": None}
    # Auth tokens live in ~/.claude/ — presence of any .json there is a good proxy
    authenticated = _CLAUDE_DIR.is_dir() and any(_CLAUDE_DIR.glob("*.json"))
    return {"installed": True, "authenticated": authenticated, "path": path, "version": None}


@router.get("/claude-auth/status")
async def claude_auth_status() -> dict[str, Any]:
    """Check if claude CLI is installed and authenticated."""
    info = _detect_claude()
    if not info["installed"]:
        return info

    try:
        proc = await asyncio.create_subprocess_exec(
            info["path"], "--version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=6)
        info["version"] = stdout.decode().strip()
    except Exception:
        pass

    return info


@router.post("/claude-auth/login")
async def trigger_claude_login() -> dict[str, Any]:
    """Launch `claude auth login` in a detached subprocess (opens browser OAuth)."""
    info = _detect_claude()
    if not info["installed"]:
        return {
            "ok": False,
            "error": "Claude CLI not found. Install it with: npm install -g @anthropic-ai/claude-code",
        }

    try:
        # Fire-and-forget — the process will open the browser and wait interactively.
        # We detach so the backend request returns immediately.
        await asyncio.create_subprocess_exec(
            info["path"], "auth", "login",
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
            stdin=asyncio.subprocess.DEVNULL,
        )
        return {"ok": True, "message": "Browser opened — complete the login flow there, then click Refresh."}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@router.get("/system")
async def system_info() -> dict[str, Any]:
    """Basic system info for the Settings panel."""
    return {
        "python_version": sys.version.split()[0],
        "platform": platform.system(),
        "platform_version": platform.version(),
        "machine": platform.machine(),
        "claude_dir": str(_CLAUDE_DIR) if _CLAUDE_DIR.is_dir() else None,
    }
