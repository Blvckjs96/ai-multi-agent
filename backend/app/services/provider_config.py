"""Business logic for user-configured LLM providers and Claude model selection."""

import time
from uuid import UUID

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import NotFoundError, ValidationError
from app.db.models.provider_config import ProviderType, UserProviderConfig
from app.repositories import provider_config as repo
from app.schemas.provider_config import (
    ClaudeModelInfo,
    ProviderConfigCreate,
    ProviderConfigRead,
    ProviderConfigUpdate,
    ProviderTestResult,
)

CLAUDE_MODELS: list[ClaudeModelInfo] = [
    ClaudeModelInfo(
        id="claude-haiku-4-5",
        display_name="Claude Haiku 4.5",
        tier="fast",
        description="Fastest model. Best for high-frequency tasks and worker agents.",
        context_window=200_000,
    ),
    ClaudeModelInfo(
        id="claude-sonnet-4-6",
        display_name="Claude Sonnet 4.6",
        tier="balanced",
        description="Best coding model. Main development and complex tasks.",
        context_window=200_000,
    ),
    ClaudeModelInfo(
        id="claude-opus-4-7",
        display_name="Claude Opus 4.7",
        tier="powerful",
        description="Deepest reasoning. Architectural decisions and research.",
        context_window=200_000,
    ),
]

_CLAUDE_MODEL_IDS = {m.id for m in CLAUDE_MODELS}


def _to_read(config: UserProviderConfig) -> ProviderConfigRead:
    return ProviderConfigRead(
        id=config.id,
        name=config.name,
        provider_type=config.provider_type,
        host_url=config.host_url,
        api_key_set=bool(config.api_key),
        model_name=config.model_name,
        is_enabled=config.is_enabled,
        is_default=config.is_default,
        extra_config=config.extra_config,
    )


class ProviderConfigService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_configs(self) -> list[ProviderConfigRead]:
        configs = await repo.get_all(self.db)
        return [_to_read(c) for c in configs]

    async def create_config(self, data: ProviderConfigCreate) -> ProviderConfigRead:
        if data.provider_type not in {pt.value for pt in ProviderType}:
            raise ValidationError(
                message=f"Unknown provider type: {data.provider_type!r}",
                details={"allowed": [pt.value for pt in ProviderType]},
            )
        if data.is_default:
            await repo.clear_defaults(self.db)
        config = await repo.create(
            self.db,
            name=data.name,
            provider_type=data.provider_type,
            host_url=data.host_url,
            api_key=data.api_key,
            model_name=data.model_name,
            is_enabled=data.is_enabled,
            is_default=data.is_default,
            extra_config=data.extra_config,
        )
        return _to_read(config)

    async def update_config(self, config_id: UUID, data: ProviderConfigUpdate) -> ProviderConfigRead:
        config = await repo.get_by_id(self.db, config_id)
        if not config:
            raise NotFoundError(message="Provider config not found", details={"id": str(config_id)})
        update_data = {k: v for k, v in data.model_dump(exclude_none=True).items()}
        if update_data.get("is_default"):
            await repo.clear_defaults(self.db)
        config = await repo.update(self.db, db_config=config, update_data=update_data)
        return _to_read(config)

    async def delete_config(self, config_id: UUID) -> None:
        config = await repo.get_by_id(self.db, config_id)
        if not config:
            raise NotFoundError(message="Provider config not found", details={"id": str(config_id)})
        await repo.delete(self.db, config_id)

    async def test_config(self, config_id: UUID) -> ProviderTestResult:
        config = await repo.get_by_id(self.db, config_id)
        if not config:
            raise NotFoundError(message="Provider config not found", details={"id": str(config_id)})
        return await _probe_provider(config)

    def list_claude_models(self) -> list[ClaudeModelInfo]:
        return CLAUDE_MODELS

    def get_active_claude_model(self) -> str:
        return settings.AI_REASONING_MODEL

    async def select_claude_model(self, model_id: str) -> str:
        if model_id not in _CLAUDE_MODEL_IDS:
            raise ValidationError(
                message=f"Unknown Claude model: {model_id!r}",
                details={"allowed": list(_CLAUDE_MODEL_IDS)},
            )
        settings.AI_REASONING_MODEL = model_id  # type: ignore[misc]
        settings.AI_FAST_MODEL = model_id  # type: ignore[misc]
        return model_id


async def _probe_provider(config: UserProviderConfig) -> ProviderTestResult:
    start = time.monotonic()
    try:
        if config.provider_type == ProviderType.OLLAMA:
            url = (config.host_url or "http://localhost:11434").rstrip("/")
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get(f"{url}/api/tags")
                r.raise_for_status()
            latency = (time.monotonic() - start) * 1000
            return ProviderTestResult(ok=True, latency_ms=round(latency, 1), error=None)

        if config.provider_type in (ProviderType.ANTHROPIC, ProviderType.OPENAI_COMPATIBLE, ProviderType.NIM):
            # Check that an API key is present — don't make a real API call to avoid billing
            if not config.api_key:
                return ProviderTestResult(ok=False, latency_ms=None, error="No API key configured")
            latency = (time.monotonic() - start) * 1000
            return ProviderTestResult(ok=True, latency_ms=round(latency, 1), error=None)

        return ProviderTestResult(ok=False, latency_ms=None, error=f"Unsupported probe for {config.provider_type!r}")
    except Exception as exc:
        return ProviderTestResult(ok=False, latency_ms=None, error=str(exc))
