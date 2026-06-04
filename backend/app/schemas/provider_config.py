"""Pydantic schemas for user provider configs and Claude model selection."""

from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema


class ProviderConfigCreate(BaseSchema):
    name: str = Field(max_length=100)
    provider_type: str = Field(max_length=30)
    host_url: str | None = Field(default=None)
    api_key: str | None = Field(default=None)
    model_name: str | None = Field(default=None, max_length=200)
    is_enabled: bool = True
    is_default: bool = False
    extra_config: dict | None = None


class ProviderConfigUpdate(BaseSchema):
    name: str | None = Field(default=None, max_length=100)
    provider_type: str | None = Field(default=None, max_length=30)
    host_url: str | None = None
    api_key: str | None = None
    model_name: str | None = Field(default=None, max_length=200)
    is_enabled: bool | None = None
    is_default: bool | None = None
    extra_config: dict | None = None


class ProviderConfigRead(BaseSchema):
    id: UUID
    name: str
    provider_type: str
    host_url: str | None
    api_key_set: bool
    model_name: str | None
    is_enabled: bool
    is_default: bool
    extra_config: dict | None


class ProviderConfigList(BaseSchema):
    items: list[ProviderConfigRead]
    total: int


class ClaudeModelInfo(BaseSchema):
    id: str
    display_name: str
    tier: str
    description: str
    context_window: int


class ClaudeModelList(BaseSchema):
    models: list[ClaudeModelInfo]
    active_model: str


class ClaudeModelSelect(BaseSchema):
    model_id: str = Field(max_length=100)


class ProviderTestResult(BaseSchema):
    ok: bool
    latency_ms: float | None
    error: str | None
