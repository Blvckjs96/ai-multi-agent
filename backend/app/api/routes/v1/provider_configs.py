"""User-configured LLM providers and Claude model selector."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DBSession
from app.schemas.provider_config import (
    ClaudeModelList,
    ClaudeModelSelect,
    ProviderConfigCreate,
    ProviderConfigList,
    ProviderConfigRead,
    ProviderConfigUpdate,
    ProviderTestResult,
)
from app.services.provider_config import ProviderConfigService

router = APIRouter(prefix="/providers", tags=["provider-configs"])


def _svc(db: DBSession) -> ProviderConfigService:
    return ProviderConfigService(db)


# ── User provider CRUD ────────────────────────────────────────────────────────


@router.get("/configs", response_model=ProviderConfigList)
async def list_provider_configs(db: DBSession, _user: CurrentUser) -> Any:
    svc = _svc(db)
    items = await svc.list_configs()
    return ProviderConfigList(items=items, total=len(items))


@router.post("/configs", response_model=ProviderConfigRead, status_code=status.HTTP_201_CREATED)
async def create_provider_config(
    data: ProviderConfigCreate, db: DBSession, _user: CurrentUser
) -> Any:
    return await _svc(db).create_config(data)


@router.patch("/configs/{config_id}", response_model=ProviderConfigRead)
async def update_provider_config(
    config_id: UUID, data: ProviderConfigUpdate, db: DBSession, _user: CurrentUser
) -> Any:
    return await _svc(db).update_config(config_id, data)


@router.delete("/configs/{config_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_provider_config(config_id: UUID, db: DBSession, _user: CurrentUser) -> None:
    await _svc(db).delete_config(config_id)


@router.post("/configs/{config_id}/test", response_model=ProviderTestResult)
async def test_provider_config(config_id: UUID, db: DBSession, _user: CurrentUser) -> Any:
    return await _svc(db).test_config(config_id)


# ── Claude model selector ─────────────────────────────────────────────────────


@router.get("/llm/models", response_model=ClaudeModelList)
async def list_claude_models(db: DBSession) -> Any:
    svc = _svc(db)
    models = svc.list_claude_models()
    active = svc.get_active_claude_model()
    return ClaudeModelList(models=models, active_model=active)


@router.get("/llm/current")
async def get_active_claude_model(db: DBSession) -> Any:
    svc = _svc(db)
    active = svc.get_active_claude_model()
    models = svc.list_claude_models()
    info = next((m for m in models if m.id == active), None)
    return {"model_id": active, "display_name": info.display_name if info else active}


@router.post("/llm/select")
async def select_claude_model(data: ClaudeModelSelect, db: DBSession) -> Any:
    model_id = await _svc(db).select_claude_model(data.model_id)
    return {"model_id": model_id, "ok": True}
