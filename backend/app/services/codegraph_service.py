"""CodegraphService — manages one codegraph MCP server process per workspace.

Codegraph indexes a git repository with tree-sitter and exposes 8 MCP tools
that let Claude understand any codebase without grep/Read loops.

Process lifecycle:
  - ensure_running(workspace) → starts node process + waits for SSE readiness
  - stop(workspace_id)       → terminates process, frees port
  - stop_all()               → graceful shutdown (called on app shutdown)

Ports are allocated sequentially from BASE_PORT. A workspace that exits
unexpectedly is removed from the registry so the next call re-launches it.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from uuid import UUID

logger = logging.getLogger(__name__)

# Absolute path to the built codegraph binary relative to the project root.
# __file__ is  backend/app/services/codegraph_service.py
# so we go: → backend/ → project root → codegraph/dist/bin/codegraph.js
_SERVICE_DIR = Path(__file__).parent
_BACKEND_DIR = _SERVICE_DIR.parent.parent  # app/ → backend/
_PROJECT_ROOT = _BACKEND_DIR.parent  # backend/ → project root
CODEGRAPH_BIN = _PROJECT_ROOT / "codegraph" / "dist" / "bin" / "codegraph.js"

BASE_PORT = 20200
_MAX_STARTUP_WAIT = 10.0  # seconds to wait for SSE endpoint to appear


class CodegraphService:
    """Singleton service that keeps one codegraph MCP process alive per workspace."""

    _processes: dict[UUID, asyncio.subprocess.Process] = {}
    _ports: dict[UUID, int] = {}
    _next_port: int = BASE_PORT

    def _allocate_port(self) -> int:
        port = self._next_port
        self._next_port += 1
        return port

    def _is_running(self, workspace_id: UUID) -> bool:
        proc = self._processes.get(workspace_id)
        return proc is not None and proc.returncode is None

    async def ensure_running(self, workspace_id: UUID, repo_path: str) -> int:
        """Return the SSE port for a workspace, starting codegraph if needed."""
        if self._is_running(workspace_id):
            return self._ports[workspace_id]

        if not CODEGRAPH_BIN.exists():
            raise RuntimeError(
                f"Codegraph binary not found at {CODEGRAPH_BIN}. "
                "Run `npm run build` inside the codegraph/ directory."
            )

        repo = Path(repo_path)
        if not repo.is_dir():
            raise ValueError(f"Workspace path does not exist: {repo_path}")

        db_path = repo / ".argo" / "codegraph.db"
        db_path.parent.mkdir(parents=True, exist_ok=True)

        port = self._allocate_port()

        proc = await asyncio.create_subprocess_exec(
            "node",
            str(CODEGRAPH_BIN),
            "serve",
            "--mcp",
            "--db",
            str(db_path),
            "--port",
            str(port),
            cwd=str(repo),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        self._processes[workspace_id] = proc
        self._ports[workspace_id] = port

        # Wait until the SSE endpoint is ready (codegraph prints "Listening")
        await self._wait_for_ready(workspace_id, port)

        logger.info(
            "Codegraph MCP started for workspace %s on port %d (db=%s)",
            workspace_id,
            port,
            db_path,
        )
        return port

    async def _wait_for_ready(self, workspace_id: UUID, port: int) -> None:
        """Poll until codegraph's SSE endpoint responds or timeout."""
        import socket

        deadline = asyncio.get_event_loop().time() + _MAX_STARTUP_WAIT
        while asyncio.get_event_loop().time() < deadline:
            if not self._is_running(workspace_id):
                raise RuntimeError(f"Codegraph process for {workspace_id} exited during startup")
            try:
                with socket.create_connection(("127.0.0.1", port), timeout=0.3):
                    return
            except OSError:
                await asyncio.sleep(0.25)
        logger.warning("Codegraph on port %d did not become ready in %.1fs", port, _MAX_STARTUP_WAIT)

    async def stop(self, workspace_id: UUID) -> None:
        """Terminate the codegraph process for a workspace."""
        proc = self._processes.pop(workspace_id, None)
        self._ports.pop(workspace_id, None)
        if proc is not None and proc.returncode is None:
            try:
                proc.terminate()
                await asyncio.wait_for(proc.wait(), timeout=5.0)
            except Exception:
                proc.kill()

    async def stop_all(self) -> None:
        """Graceful shutdown — call from FastAPI lifespan on_shutdown."""
        for wid in list(self._processes.keys()):
            await self.stop(wid)

    def status(self, workspace_id: UUID) -> dict:
        """Return current status dict for a workspace."""
        running = self._is_running(workspace_id)
        return {
            "workspace_id": str(workspace_id),
            "running": running,
            "port": self._ports.get(workspace_id) if running else None,
            "bin_exists": CODEGRAPH_BIN.exists(),
        }


# Module-level singleton — imported by routes and lifespan
codegraph_service = CodegraphService()
