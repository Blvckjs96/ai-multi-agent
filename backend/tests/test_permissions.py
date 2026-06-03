"""Tests for the OWU-pattern permissions system."""
import pytest
from app.core.permissions import has_permission_sync, fill_missing_permissions

_DEFAULT = {
    "chat": {"file_upload": True, "delete": True},
    "workspace": {"knowledge": {"create": False}},
}


def test_has_permission_top_level_true():
    perms = {"chat": {"file_upload": True}}
    assert has_permission_sync(perms, "chat.file_upload") is True


def test_has_permission_top_level_false():
    perms = {"chat": {"file_upload": False}}
    assert has_permission_sync(perms, "chat.file_upload") is False


def test_has_permission_nested_true():
    perms = {"workspace": {"knowledge": {"create": True}}}
    assert has_permission_sync(perms, "workspace.knowledge.create") is True


def test_has_permission_missing_key_returns_false():
    assert has_permission_sync({}, "chat.file_upload") is False


def test_has_permission_partial_path_returns_false():
    perms = {"chat": {"file_upload": True}}
    assert has_permission_sync(perms, "chat.nonexistent") is False


def test_fill_missing_permissions_preserves_user_value():
    partial = {"chat": {"file_upload": False}}
    filled = fill_missing_permissions(partial, _DEFAULT)
    assert filled["chat"]["file_upload"] is False  # user value kept


def test_fill_missing_permissions_fills_default():
    partial = {"chat": {"file_upload": False}}
    filled = fill_missing_permissions(partial, _DEFAULT)
    assert filled["chat"]["delete"] is True  # filled from default


def test_fill_missing_permissions_adds_top_level_key():
    filled = fill_missing_permissions({}, _DEFAULT)
    assert "workspace" in filled
    assert filled["workspace"]["knowledge"]["create"] is False
