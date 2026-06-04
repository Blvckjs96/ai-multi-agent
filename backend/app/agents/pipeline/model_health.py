"""Per-model health tracking — exponential backoff lock system.

Ported from 9router's open-sse/services/accountFallback.js pattern.
Lock a model on 429/5xx; lazy-clean on success. Quality-fail tracking
for orchestration use (separate from hard technical locks).
"""

from __future__ import annotations

import time
from dataclasses import dataclass

MAX_BACKOFF_SECONDS = 300  # 5 minutes max, same as 9router MAX_RATE_LIMIT_COOLDOWN_MS


@dataclass
class ModelHealth:
    # Technical health (9router-style hard lock)
    tech_locked_until: float = 0.0
    tech_backoff_level: int = 0
    last_error: str = ""
    last_status_code: int = 0
    # Quality health (semantic — for orchestrator use)
    quality_fail_streak: int = 0
    quality_depriority_until: float = 0.0
    # Stats
    total_calls: int = 0
    total_errors: int = 0
    last_used_at: float = 0.0


# Global registry: key = "provider/model_name"
_health: dict[str, ModelHealth] = {}


def _key(provider: str, model: str) -> str:
    return f"{provider}/{model}"


def get_health(provider: str, model: str) -> ModelHealth:
    return _health.setdefault(_key(provider, model), ModelHealth())


def is_tech_locked(provider: str, model: str) -> bool:
    """True if model is under a hard technical cooldown lock."""
    h = _health.get(_key(provider, model))
    if h is None:
        return False
    now = time.monotonic()
    if now >= h.tech_locked_until:
        if h.tech_locked_until > 0:
            # Lazy-clean the lock once TTL expires
            h.tech_locked_until = 0.0
        return False
    return True


def is_quality_deprioritized(provider: str, model: str) -> bool:
    """True if model has been soft-deprioritized due to quality failures."""
    h = _health.get(_key(provider, model))
    if h is None:
        return False
    return time.monotonic() < h.quality_depriority_until


def mark_tech_error(provider: str, model: str, status_code: int, error: str = "") -> float:
    """Lock model after a technical error (429, 5xx).

    Returns the cooldown duration in seconds.
    Uses exponential backoff: 2^level * 2 seconds (2s, 4s, 8s... capped at 300s).
    """
    h = get_health(provider, model)
    cooldown = min(2**h.tech_backoff_level * 2, MAX_BACKOFF_SECONDS)
    h.tech_locked_until = time.monotonic() + cooldown
    h.tech_backoff_level += 1
    h.last_error = error
    h.last_status_code = status_code
    h.total_errors += 1
    return cooldown


def mark_quality_fail(provider: str, model: str) -> None:
    """Soft-deprioritize after consecutive quality evaluation failures.

    After 3 consecutive fails, deprioritize for 10 minutes.
    """
    h = get_health(provider, model)
    h.quality_fail_streak += 1
    if h.quality_fail_streak >= 3:
        h.quality_depriority_until = time.monotonic() + 600


def mark_success(provider: str, model: str) -> None:
    """Reset health state on success — lazy cleanup of both lock types."""
    h = get_health(provider, model)
    h.tech_locked_until = 0.0
    h.tech_backoff_level = max(0, h.tech_backoff_level - 1)
    h.quality_fail_streak = 0
    h.total_calls += 1
    h.last_used_at = time.monotonic()


def get_all_status() -> dict[str, dict]:
    """Return health snapshot for all known models — used by /providers/health endpoint."""
    now = time.monotonic()
    result = {}
    for key, h in _health.items():
        tech_locked = now < h.tech_locked_until
        quality_dep = now < h.quality_depriority_until
        result[key] = {
            "tech_locked": tech_locked,
            "tech_locked_until_secs": max(0.0, h.tech_locked_until - now) if tech_locked else 0.0,
            "tech_backoff_level": h.tech_backoff_level,
            "quality_fail_streak": h.quality_fail_streak,
            "quality_deprioritized": quality_dep,
            "last_error": h.last_error,
            "last_status_code": h.last_status_code,
            "total_calls": h.total_calls,
            "total_errors": h.total_errors,
        }
    return result


def reset_all() -> None:
    """Clear all health state — for testing or manual reset."""
    _health.clear()
