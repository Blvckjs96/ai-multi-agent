"""Permission utilities — ported from OWU access_control pattern.

Permissions are nested dicts. Keys use dot notation for lookup:
  has_permission_sync(perms, "workspace.knowledge.create")
Groups merge permissions — most permissive value wins (True > False).
"""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

DEFAULT_USER_PERMISSIONS: dict[str, Any] = {
    "chat": {
        "file_upload": True,
        "delete": True,
        "edit": True,
        "temporary": True,
        "voice_input": True,
    },
    "workspace": {
        "models":    {"create": False, "update": False, "delete": False, "share": False},
        "knowledge": {"create": True,  "update": True,  "delete": True,  "share": False},
        "tools":     {"create": False, "update": False, "delete": False, "share": False},
        "skills":    {"create": True,  "update": True,  "delete": True,  "share": False},
        "prompts":   {"create": True,  "update": True,  "delete": True,  "share": False},
    },
    "terminal": {"execute": True},
    "artifacts": {"read": True, "write": True},
}


def fill_missing_permissions(
    permissions: dict[str, Any],
    default_permissions: dict[str, Any],
) -> dict[str, Any]:
    """Recursively fill missing keys from defaults without mutating defaults."""
    for key, value in default_permissions.items():
        if key not in permissions:
            permissions[key] = value
        elif isinstance(value, dict) and isinstance(permissions[key], dict):
            permissions[key] = fill_missing_permissions(permissions[key], value)
    return permissions


def _combine(a: dict[str, Any], b: dict[str, Any]) -> dict[str, Any]:
    """Merge two permission dicts taking the most permissive value (True > False)."""
    for key, value in b.items():
        if isinstance(value, dict):
            a[key] = _combine(a.get(key, {}), value)
        else:
            a[key] = a.get(key, value) or value
    return a


def has_permission_sync(
    permissions: dict[str, Any],
    permission_key: str,
) -> bool:
    """Check a dotted permission key. Returns False if any segment is missing."""
    node: Any = permissions
    for k in permission_key.split("."):
        if not isinstance(node, dict) or k not in node:
            return False
        node = node[k]
    return bool(node)


async def get_user_permissions(
    user_id: str,
    db: AsyncSession,
) -> dict[str, Any]:
    """Return merged permissions for a user from all their groups."""
    from app.repositories.group import get_groups_by_member_id  # late import — avoids circular

    groups = await get_groups_by_member_id(db, str(user_id))
    permissions = json.loads(json.dumps(DEFAULT_USER_PERMISSIONS))
    for group in groups:
        if group.permissions:
            permissions = _combine(permissions, group.permissions)
    return permissions


async def has_permission(
    user_id: str,
    permission_key: str,
    db: AsyncSession,
) -> bool:
    """Async check: resolve user's merged permissions and evaluate a dotted key."""
    perms = await get_user_permissions(user_id, db)
    return has_permission_sync(perms, permission_key)
