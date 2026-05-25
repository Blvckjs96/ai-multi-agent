"""ProviderRegistry — runtime embedding model management.

Active model is persisted in ChironConfig (workspace_id=NULL, key='embedding_model').
Switching model resets the EmbeddingService singleton so the next request uses the new model.

Usage:
    model_id = await get_active_embedding_model(db)
    await set_active_embedding_model(db, "nomic-embed-text")
"""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

_EMBEDDING_MODEL_KEY = "embedding_model"


async def get_active_embedding_model(db: AsyncSession) -> str:
    """Read active embedding model from DB, fallback to settings."""
    from app.core.config import settings
    from app.db.models.chiron import ChironConfig

    result = await db.execute(
        select(ChironConfig.value).where(
            ChironConfig.workspace_id.is_(None),
            ChironConfig.key == _EMBEDDING_MODEL_KEY,
        )
    )
    val = result.scalar_one_or_none()
    if val and isinstance(val, str):
        return val
    return settings.CHIRON_EMBEDDING_MODEL


async def set_active_embedding_model(db: AsyncSession, model_id: str) -> None:
    """Persist model selection and reset EmbeddingService singleton."""
    from app.db.models.chiron import ChironConfig

    result = await db.execute(
        select(ChironConfig).where(
            ChironConfig.workspace_id.is_(None),
            ChironConfig.key == _EMBEDDING_MODEL_KEY,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.value = model_id
    else:
        db.add(ChironConfig(workspace_id=None, key=_EMBEDDING_MODEL_KEY, value=model_id))

    await db.flush()

    # Reset singleton so next embed call uses the new model
    from app.chiron.ai import embedding_service as _svc_module

    _svc_module.set_active_model(model_id)
    logger.info("ProviderRegistry: embedding model switched to %r", model_id)


async def get_installed_ollama_models(ollama_base_url: str) -> list[str]:
    """Fetch list of model IDs installed in Ollama."""
    import httpx

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{ollama_base_url}/api/tags")
            resp.raise_for_status()
            data = resp.json()
            return [m["name"] for m in data.get("models", [])]
    except Exception:
        logger.warning("ProviderRegistry: could not reach Ollama at %r", ollama_base_url)
        return []
