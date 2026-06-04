"""Migration tests — verify Alembic upgrade/downgrade cycle.

These tests ensure that:
1. All migrations can be applied (upgrade head)
2. All migrations can be rolled back (downgrade base)
3. The upgrade/downgrade cycle is idempotent

NOTE: Migration 0005 requires the pgvector PostgreSQL extension.
If the local PostgreSQL does not have pgvector installed, these tests
are automatically skipped. In production/CI, pgvector is available via
Docker (ankane/pgvector). Install locally with:
  brew install pgvector   # macOS
"""

import subprocess
import sys

import pytest


def _pgvector_available() -> bool:
    """Return True if the local PostgreSQL has pgvector installed."""
    result = subprocess.run(
        [
            sys.executable, "-c",
            (
                "import psycopg2, os; "
                "c = psycopg2.connect(os.environ.get('DATABASE_URL', 'postgresql://localhost/argo_test')); "
                "cur = c.cursor(); "
                "cur.execute(\"SELECT 1 FROM pg_available_extensions WHERE name = 'vector'\"); "
                "print(bool(cur.fetchone()))"
            ),
        ],
        capture_output=True,
        text=True,
    )
    return result.returncode == 0 and "True" in result.stdout


_PGVECTOR_SKIP = pytest.mark.skipif(
    not _pgvector_available(),
    reason="pgvector extension not installed on local PostgreSQL — skipped (use Docker for full tests)",
)


@_PGVECTOR_SKIP
class TestMigrations:
    """Test Alembic migration integrity."""

    def test_upgrade_head(self):
        """Test that all migrations can be applied successfully."""
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
            cwd=".",
        )
        assert result.returncode == 0, f"Migration upgrade failed:\n{result.stderr}"

    def test_downgrade_base(self):
        """Test that all migrations can be rolled back."""
        # First upgrade to head
        up = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
            cwd=".",
        )
        assert up.returncode == 0, f"Migration upgrade failed:\n{up.stderr}"

        # Then downgrade to base
        down = subprocess.run(
            [sys.executable, "-m", "alembic", "downgrade", "base"],
            capture_output=True,
            text=True,
            cwd=".",
        )
        assert down.returncode == 0, f"Migration downgrade failed:\n{down.stderr}"

    def test_upgrade_downgrade_cycle(self):
        """Test that upgrade → downgrade → upgrade produces consistent state."""
        for cmd in ["upgrade head", "downgrade base", "upgrade head"]:
            action, target = cmd.split()
            result = subprocess.run(
                [sys.executable, "-m", "alembic", action, target],
                capture_output=True,
                text=True,
                cwd=".",
            )
            assert result.returncode == 0, f"alembic {cmd} failed:\n{result.stderr}"

    def test_current_matches_head(self):
        """Test that current migration revision matches head after upgrade."""
        # Upgrade to head first
        up = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
            cwd=".",
        )
        assert up.returncode == 0, f"Migration upgrade failed:\n{up.stderr}"

        # Check if there are any migration revisions
        heads = subprocess.run(
            [sys.executable, "-m", "alembic", "heads"],
            capture_output=True,
            text=True,
            cwd=".",
        )
        assert heads.returncode == 0

        if not heads.stdout.strip():
            pytest.skip("No migration revisions found — nothing to verify")

        # Check current
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "current"],
            capture_output=True,
            text=True,
            cwd=".",
        )
        assert result.returncode == 0
        assert "(head)" in result.stdout, (
            f"Current revision is not at head:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        )
