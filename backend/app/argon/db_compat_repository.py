"""Repository compatibility shim for Argon.

Re-exports the generic CRUD Repository from the canonical location.
"""

from app.argon.repository import Repository  # noqa: F401

__all__ = ["Repository"]
