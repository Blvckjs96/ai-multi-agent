"""Argorouter API — proxy to the Argorouter AI gateway at localhost:20128."""

from typing import Any

import httpx
from fastapi import APIRouter, status

from app.api.deps import CurrentUser

ARGOROUTER_URL = "http://localhost:20128"
TIMEOUT = 3.0

router = APIRouter(prefix="/argorouter", tags=["argorouter"])


async def _get(path: str) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.get(f"{ARGOROUTER_URL}{path}")
            r.raise_for_status()
            return r.json()
    except Exception as exc:
        return {"connected": False, "error": str(exc)}


@router.get("/status")
async def get_status(_: CurrentUser) -> Any:
    """Return Argorouter health and version info."""
    data = await _get("/api/health")
    return {"connected": data.get("connected", True), **data}


@router.get("/providers")
async def list_providers(_: CurrentUser) -> Any:
    """Return configured provider connections."""
    return await _get("/api/providers")


@router.get("/usage")
async def get_usage(_: CurrentUser) -> Any:
    """Return token/cost usage stats."""
    return await _get("/api/usage")


@router.get("/aliases")
async def list_aliases(_: CurrentUser) -> Any:
    """Return model alias mappings."""
    return await _get("/api/aliases")


@router.delete(
    "/providers/{provider_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def remove_provider(provider_id: str, _: CurrentUser) -> None:
    """Remove a provider connection from Argorouter."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.delete(f"{ARGOROUTER_URL}/api/providers/{provider_id}")
            r.raise_for_status()
    except Exception:
        pass
