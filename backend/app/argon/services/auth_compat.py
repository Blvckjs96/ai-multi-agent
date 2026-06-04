"""Auth compatibility shim for Argon.

Argon's original code used its own auth_service module. This shim
re-exports Argo's auth dependencies under the names Argon expects.

In Argo's single-user desktop mode, all authenticated users have all
permissions — no fine-grained RBAC is enforced at the dependency level.
"""

from fastapi import Depends

from app.api.deps import (  # noqa: F401
    get_current_user,
    get_current_active_superuser,
    ValidAPIKey,
    CurrentAdmin,
)
from app.core.security import get_password_hash as hash_password  # noqa: F401

require_admin = Depends(get_current_active_superuser)


def require_permission(permission: str):
    """Return a FastAPI Depends() that verifies the user is authenticated.

    Argo desktop mode grants all permissions to any authenticated user.
    The `permission` string is accepted but not enforced.
    """
    return Depends(get_current_user)


__all__ = [
    "get_current_user",
    "require_admin",
    "require_permission",
    "hash_password",
    "ValidAPIKey",
    "get_current_active_superuser",
    "CurrentAdmin",
]
