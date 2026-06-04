"""Provider status and routing mode endpoints.

GET  /providers/status        → current availability of all AI providers
POST /providers/refresh       → force re-probe (clears TTL cache)
GET  /providers/health        → real-time health + per-model lock state
POST /providers/health/reset  → clear all model locks and provider cache
GET  /providers/local-models  → list available Ollama models with tier metadata
"""

import logging
from typing import Any

import httpx
from fastapi import APIRouter

from app.agents.pipeline.model_health import get_all_status, reset_all
from app.agents.pipeline.model_router import (
    get_provider_status,
    reset_provider_cache,
)
from app.api.deps import ValidAPIKey
from app.core.config import settings

router = APIRouter(prefix="/providers", tags=["providers"])
logger = logging.getLogger(__name__)


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


@router.get("/local-models")
async def list_local_models() -> dict[str, Any]:
    """List available Ollama models enriched with ArgoHarness tier metadata.

    Response shape:
        {
            "ollama_available": true,
            "models": [
                {
                    "id": "gemma4:31b-cloud",
                    "tier": 2,
                    "installed": true,
                    "context_window": 262144,
                    "supports_thinking": true,
                    "label": "Gemma4 31B · 262K ctx · Thinking"
                },
                ...
            ]
        }

    Models are sorted: installed first, then by tier descending, then by id.
    Tier-0 judge models are excluded from the response.
    Unknown installed models (not in catalog) are included with tier=1 defaults.
    """
    from app.services.connectivity import ollama_is_online
    from app.services.model_tier_selector import _KNOWN_MODELS, get_model_catalog

    ollama_up = await ollama_is_online()
    if not ollama_up:
        return {
            "ollama_available": False,
            "models": [],
            "hint": f"Ollama not reachable at {settings.OLLAMA_HOST}. Start Ollama and refresh.",
        }

    # Fetch installed model names from Ollama
    installed_names: set[str] = set()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.OLLAMA_HOST.rstrip('/')}/api/tags")
        if resp.status_code == 200:
            for m in resp.json().get("models", []):
                installed_names.add(m.get("name", ""))
    except Exception as exc:
        logger.warning("Failed to fetch Ollama model list: %s", exc)

    # Build response from catalog
    catalog = get_model_catalog()  # already excludes tier-0
    models = []
    # seen tracks ALL known models (incl. tier-0) so they're not re-added below
    seen: set[str] = set(_KNOWN_MODELS.keys())

    for entry in catalog:
        model_id = entry["id"]
        models.append({**entry, "installed": model_id in installed_names})

    # Include installed models not in catalog and not in known list at all
    # (user may have pulled models we don't catalog)
    for name in sorted(installed_names):
        if name in seen:
            continue
        # Skip embedding models and obvious non-chat models
        skip_prefixes = ("nomic-", "mxbai-", "all-minilm", "snowflake-")
        if any(name.startswith(p) for p in skip_prefixes):
            continue
        models.append({
            "id": name,
            "tier": 1,
            "installed": True,
            "context_window": 32_768,
            "supports_thinking": False,
            "label": name,
        })

    # Sort: installed first, then tier desc, then name asc
    models.sort(key=lambda m: (not m["installed"], -m["tier"], m["id"]))

    return {
        "ollama_available": True,
        "models": models,
    }
