"""Chiron provider management — hardware detection, model catalog, runtime switching.

GET  /chiron/providers/hardware                  detect system RAM / CPU / GPU
GET  /chiron/providers/embedding/models          catalog + per-model recommendation
GET  /chiron/providers/embedding/current         currently active embedding model
POST /chiron/providers/embedding/select          switch active embedding model
"""

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.api.deps import CurrentUser, DBSession
from app.chiron.providers.catalog import SCHEMA_EMBEDDING_DIM, get_model, recommend
from app.chiron.providers.hardware import detect_hardware
from app.chiron.providers.registry import (
    get_active_embedding_model,
    get_installed_ollama_models,
    set_active_embedding_model,
)
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chiron/providers", tags=["chiron-providers"])


# ── Hardware ─────────────────────────────────────────────────────────────────


@router.get("/hardware")
async def hardware_info() -> dict[str, Any]:
    """Return detected system hardware: RAM, CPU cores, GPU name and VRAM."""
    hw = detect_hardware()
    return {
        "ram_gb": hw.ram_gb,
        "cpu_cores": hw.cpu_cores,
        "platform": hw.platform,
        "arch": hw.arch,
        "has_apple_silicon": hw.has_apple_silicon,
        "gpus": [
            {"name": g.name, "vram_gb": g.vram_gb, "backend": g.backend}
            for g in hw.gpus
        ],
    }


# ── Embedding model catalog ───────────────────────────────────────────────────


@router.get("/embedding/models")
async def list_embedding_models(db: DBSession) -> dict[str, Any]:
    """Return all embedding models with hardware-aware recommendations.

    Each model includes:
    - tier: "recommended" | "needs_migration" | "insufficient_ram"
    - is_installed: whether it's already pulled in Ollama
    - schema_compatible: matches current pgvector column dimension
    """
    hw = detect_hardware()
    installed = await get_installed_ollama_models(settings.OLLAMA_HOST)
    active = await get_active_embedding_model(db)
    models = recommend(hw, installed)

    return {
        "active_model": active,
        "schema_dim": SCHEMA_EMBEDDING_DIM,
        "hardware": {
            "ram_gb": hw.ram_gb,
            "has_apple_silicon": hw.has_apple_silicon,
            "gpu_vram_gb": hw.effective_vram_gb,
        },
        "models": models,
    }


# ── Current model ─────────────────────────────────────────────────────────────


@router.get("/embedding/current")
async def current_embedding_model(db: DBSession) -> dict[str, Any]:
    """Return the currently active embedding model and its catalog metadata."""
    active = await get_active_embedding_model(db)
    spec = get_model(active)
    return {
        "model_id": active,
        "dim": spec.dim if spec else None,
        "name": spec.name if spec else active,
        "schema_compatible": spec.schema_compatible if spec else None,
        "ollama_pull": spec.ollama_pull if spec else f"ollama pull {active}",
    }


# ── Select model ──────────────────────────────────────────────────────────────


class SelectModelRequest(BaseModel):
    model_id: str
    force: bool = False  # allow selecting schema-incompatible models (for migration workflows)


@router.post("/embedding/select", status_code=status.HTTP_200_OK)
async def select_embedding_model(
    body: SelectModelRequest,
    db: DBSession,
    current_user: CurrentUser,
) -> dict[str, Any]:
    """Switch the active embedding model.

    Only schema-compatible models (768d) can be selected without `force=true`.
    Switching to a different dimension requires running a new Alembic migration
    and setting `force=true`.

    Existing embeddings are NOT deleted — they remain under the old model_id.
    New pages will be embedded with the new model.
    """
    spec = get_model(body.model_id)
    if spec is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model {body.model_id!r} not found in catalog.",
        )

    if not spec.schema_compatible and not body.force:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Model {body.model_id!r} uses {spec.dim}d vectors but the current pgvector "
                f"schema expects {SCHEMA_EMBEDDING_DIM}d. "
                "Run a schema migration first, then retry with force=true."
            ),
        )

    # Warn if Ollama doesn't have the model installed
    installed = await get_installed_ollama_models(settings.OLLAMA_HOST)
    is_installed = body.model_id in installed
    if not is_installed:
        logger.warning(
            "select_embedding_model: %r not found in Ollama — user must run: %s",
            body.model_id,
            spec.ollama_pull,
        )

    await set_active_embedding_model(db, body.model_id)

    return {
        "model_id": body.model_id,
        "name": spec.name,
        "dim": spec.dim,
        "schema_compatible": spec.schema_compatible,
        "is_installed": is_installed,
        "pull_command": spec.ollama_pull if not is_installed else None,
        "message": (
            f"Switched to {spec.name!r}."
            if is_installed
            else f"Switched to {spec.name!r}. Pull it first: `{spec.ollama_pull}`"
        ),
    }
