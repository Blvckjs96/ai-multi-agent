"""Provider status and routing mode endpoints.

GET  /providers/status        → current availability of all AI providers
POST /providers/refresh       → force re-probe (clears TTL cache)
GET  /providers/health        → real-time health + per-model lock state
POST /providers/health/reset  → clear all model locks and provider cache
"""

from typing import Any

from fastapi import APIRouter

from app.agents.pipeline.model_health import get_all_status, reset_all
from app.agents.pipeline.model_router import (
    get_provider_status,
    reset_provider_cache,
)
from app.api.deps import ValidAPIKey
from app.core.config import settings

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("/status")
async def provider_status() -> dict[str, Any]:
    """Return current availability of all AI providers and the active routing mode.

    Response shape:
        {
            "routing_mode": "auto",
            "providers": {
                "claude_cli": {"available": true, "path": "claude", ...},
                "ollama":     {"available": false, "host": "...", ...},
                "anthropic":  {"available": true, ...}
            }
        }
    """
    status = await get_provider_status()
    return {
        "routing_mode": settings.ROUTING_MODE,
        "providers": status,
    }


@router.post("/refresh")
async def refresh_provider_cache() -> dict[str, str]:
    """Force re-probe all providers by clearing the TTL cache.

    Useful after changing network conditions or installing the Claude CLI.
    The next call to any routing function will re-check availability.
    """
    reset_provider_cache()
    return {"status": "cache cleared — next request will re-probe all providers"}


@router.get("/health")
async def get_health(api_key: ValidAPIKey) -> dict[str, Any]:
    """Return real-time health of all providers and per-model lock state."""
    provider_status = await get_provider_status()
    model_health = get_all_status()
    return {
        "providers": provider_status,
        "model_locks": model_health,
    }


@router.post("/health/reset")
async def reset_health(api_key: ValidAPIKey) -> dict[str, str]:
    """Clear all model health locks and provider probe cache."""
    reset_all()
    reset_provider_cache()
    return {"status": "reset"}
