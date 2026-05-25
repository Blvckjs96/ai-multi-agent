"""Database compatibility shim for Argon.

Argon's original code used `from app.argon.db_compat import get_db, Base`.
This module re-exports Argo's session factory and declarative base
under those names so Argon modules work without changes.
"""

from app.db.base import Base  # noqa: F401
from app.db.session import async_session_maker as async_session_factory  # noqa: F401
from app.db.session import get_db_session as get_db  # noqa: F401
from app.db.session import get_db_context  # noqa: F401

__all__ = ["Base", "get_db", "get_db_context", "async_session_factory"]
