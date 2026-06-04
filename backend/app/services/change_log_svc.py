"""Change log service — records and retrieves Claude CLI changes per workspace."""

from __future__ import annotations

import asyncio
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.models.change_log import ChangeLog

logger = logging.getLogger(__name__)


class ChangeLogService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def record(
        self,
        workspace_id: uuid.UUID,
        prompt: str,
        session_id: str | None = None,
    ) -> ChangeLog:
        """Create a new pending change log entry."""
        entry = ChangeLog(
            workspace_id=workspace_id,
            prompt=prompt,
            session_id=session_id,
            status="pending",
        )
        self.db.add(entry)
        await self.db.flush()
        await self.db.refresh(entry)
        return entry

    async def commit(
        self,
        log_id: uuid.UUID,
        workspace_path: str,
        commit_message: str | None = None,
    ) -> ChangeLog:
        """Run `git add -A && git commit` in the workspace and record the hash."""
        entry = await self._get(log_id)
        msg = commit_message or f"argo: {entry.prompt[:72]}"

        try:
            # Capture diff before committing
            diff_proc = await asyncio.create_subprocess_exec(
                "git",
                "diff",
                "--cached",
                "--stat",
                cwd=workspace_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            diff_out, _ = await asyncio.wait_for(diff_proc.communicate(), timeout=15)

            # Stage all changes
            await asyncio.create_subprocess_exec(
                "git",
                "add",
                "-A",
                cwd=workspace_path,
            )

            # Commit
            proc = await asyncio.create_subprocess_exec(
                "git",
                "commit",
                "-m",
                msg,
                cwd=workspace_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            out, err = await asyncio.wait_for(proc.communicate(), timeout=30)

            if proc.returncode != 0:
                raise RuntimeError(err.decode())

            # Extract commit hash
            hash_proc = await asyncio.create_subprocess_exec(
                "git",
                "rev-parse",
                "HEAD",
                cwd=workspace_path,
                stdout=asyncio.subprocess.PIPE,
            )
            hash_out, _ = await asyncio.wait_for(hash_proc.communicate(), timeout=5)
            commit_hash = hash_out.decode().strip()

            # Get full diff
            full_diff_proc = await asyncio.create_subprocess_exec(
                "git",
                "show",
                "--stat",
                commit_hash,
                cwd=workspace_path,
                stdout=asyncio.subprocess.PIPE,
            )
            full_diff_out, _ = await asyncio.wait_for(full_diff_proc.communicate(), timeout=15)

            entry.git_commit_hash = commit_hash
            entry.diff = full_diff_out.decode()
            entry.status = "committed"

        except Exception as exc:
            logger.exception("git commit failed: %s", exc)
            entry.status = "pending"

        await self.db.flush()
        await self.db.refresh(entry)
        return entry

    async def revert(self, log_id: uuid.UUID, workspace_path: str) -> ChangeLog:
        """Run `git revert` on the recorded commit."""
        entry = await self._get(log_id)
        if not entry.git_commit_hash:
            raise ValueError("No commit hash to revert")

        proc = await asyncio.create_subprocess_exec(
            "git",
            "revert",
            "--no-edit",
            entry.git_commit_hash,
            cwd=workspace_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        out, err = await asyncio.wait_for(proc.communicate(), timeout=30)
        if proc.returncode != 0:
            raise RuntimeError(err.decode())

        entry.status = "reverted"
        await self.db.flush()
        await self.db.refresh(entry)
        return entry

    async def get_diff(self, log_id: uuid.UUID) -> str:
        """Return the full git diff for a log entry."""
        entry = await self._get(log_id)
        return entry.diff or ""

    async def list(
        self,
        workspace_id: uuid.UUID,
        limit: int = 50,
        skip: int = 0,
    ) -> list[ChangeLog]:
        result = await self.db.execute(
            select(ChangeLog)
            .where(ChangeLog.workspace_id == workspace_id)
            .order_by(ChangeLog.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def _get(self, log_id: uuid.UUID) -> ChangeLog:
        result = await self.db.execute(select(ChangeLog).where(ChangeLog.id == log_id))
        entry = result.scalar_one_or_none()
        if not entry:
            raise NotFoundError(message="Change log not found", details={"id": str(log_id)})
        return entry
