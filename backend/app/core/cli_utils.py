"""Utilities for locating system CLI tools from a GUI desktop app context.

When Argo is packaged as a Tauri .app and launched from Finder/Dock, macOS
does not source the user's shell profile, so PATH is minimal. Tools installed
anywhere — including external drives, nvm, fnm, volta, or custom prefixes —
won't be found by a plain shutil.which().

Resolution strategy (in order):
  1. Standard shutil.which() — works in terminal / dev mode.
  2. Login shell probe — spawns `zsh -l -c 'which <name>'` (or bash) so the
     user's ~/.zshrc / ~/.zprofile / ~/.profile is sourced. This is the same
     technique used by VSCode and IntelliJ to find binaries from GUI apps.
     Handles ANY install location including external drives.
  3. Hardcoded fallback dirs — last resort for systems where spawning a shell
     is too slow or fails (e.g., restricted sandbox).
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

_HOME = Path.home()

# Fallback dirs probed only when the login-shell approach fails.
_FALLBACK_DIRS: list[Path] = [
    _HOME / ".local" / "bin",
    Path("/usr/local/bin"),
    Path("/opt/homebrew/bin"),
    Path("/opt/homebrew/sbin"),
    Path("/usr/local/sbin"),
    _HOME / ".npm-global" / "bin",
    _HOME / "npm" / "bin",
    _HOME / ".volta" / "bin",
]


def _version_manager_bins() -> list[Path]:
    """Resolve nvm/fnm latest-version bin dirs at call time."""
    dirs: list[Path] = []
    nvm_versions = sorted((_HOME / ".nvm" / "versions" / "node").glob("*/bin"))
    if nvm_versions:
        dirs.append(nvm_versions[-1])
    fnm_versions = sorted((_HOME / ".fnm" / "node-versions").glob("*/installation/bin"))
    if fnm_versions:
        dirs.append(fnm_versions[-1])
    return dirs


def _login_shell_which(name: str, timeout: float = 5.0) -> str | None:
    """Ask the user's login shell where *name* lives.

    Spawns `<shell> -l -c 'which <name>'` so that ~/.zshrc / ~/.zprofile /
    ~/.profile etc. are sourced — exactly as if the user opened a terminal.
    Works for binaries on external drives, custom prefixes, version managers.
    """
    shell = os.environ.get("SHELL", "/bin/zsh" if sys.platform == "darwin" else "/bin/bash")
    try:
        result = subprocess.run(
            [shell, "-l", "-c", f"which {name}"],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        path = result.stdout.strip()
        if result.returncode == 0 and path:
            return path
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as exc:
        logger.debug("login-shell probe failed for %r: %s", name, exc)
    return None


def find_binary(name: str) -> str | None:
    """Return the absolute path of *name*, or None if not found anywhere.

    Tries three strategies in order so that the binary is found regardless of
    where it was installed — internal disk, external SSD, or any version manager.
    """
    # 1. Standard PATH lookup — fast, works when launched from a terminal
    found = shutil.which(name)
    if found:
        return found

    # 2. Login-shell probe — handles GUI app context and arbitrary install paths
    found = _login_shell_which(name)
    if found:
        return found

    # 3. Hardcoded fallback dirs — last resort
    all_dirs = _FALLBACK_DIRS + _version_manager_bins()
    extra = ":".join(str(p) for p in all_dirs if p.is_dir())
    if extra:
        found = shutil.which(name, path=extra + ":" + os.environ.get("PATH", ""))
        if found:
            return found
    for directory in all_dirs:
        candidate = directory / name
        if candidate.is_file():
            return str(candidate)

    return None
