"""Hybrid model router for Argo.

Three providers:
  claude_cli  — Claude Code CLI subprocess (uses Pro/Max subscription, no API credits)
  anthropic   — Anthropic API via PydanticAI (requires ANTHROPIC_API_KEY)
  ollama      — Local Ollama server (Gemma4, always free)

Five routing modes (set via ROUTING_MODE env var or per-request override):
  auto          Default. Respects per-agent preference; falls back intelligently.
  prefer_local  Ollama first, then Claude CLI, then Anthropic API.
  prefer_cloud  Claude CLI first, then Anthropic API, then Ollama.
  force_local   Ollama only — error if unreachable.
  force_cloud   Claude CLI (or API) only — error if unavailable.

Provider availability is cached for PROVIDER_PROBE_TTL_SECONDS (default 60s)
to avoid repeated network probes on every request.
"""

from __future__ import annotations

import logging
import shutil
import time
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import TYPE_CHECKING, Any

import httpx
from openai import AsyncOpenAI
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.agents.pipeline.model_health import (
    is_tech_locked,
    mark_success,
    mark_tech_error,
)
from app.core.config import settings

if TYPE_CHECKING:
    from pydantic_ai.models import Model

__all__ = [
    "AGENT_PROVIDER_MAP",
    "AGENT_ROUTING",
    "Provider",
    "RoutingDecision",
    "RoutingMode",
    "TaskType",
    "get_model_for_agent",
    "get_provider_status",
    "is_tech_locked",
    "mark_success",
    "mark_tech_error",
    "reset_provider_cache",
    "resolve_routing",
]

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class Provider(StrEnum):
    ANTHROPIC = "anthropic"
    OLLAMA = "ollama"
    CLAUDE_CLI = "claude_cli"
    NIM = "nim"


class RoutingMode(StrEnum):
    AUTO = "auto"
    PREFER_LOCAL = "prefer_local"
    PREFER_CLOUD = "prefer_cloud"
    FORCE_LOCAL = "force_local"
    FORCE_CLOUD = "force_cloud"


class TaskType(StrEnum):
    REASONING = "reasoning"  # careful analysis, structured output, precise calculations
    FAST = "fast"  # broad knowledge retrieval, long-form generation
    VISION = "vision"  # multimodal (reserved)


# ---------------------------------------------------------------------------
# Result type
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RoutingDecision:
    provider: Provider
    model_name: str  # empty string for CLAUDE_CLI (CLI picks the model)
    was_fallback: bool
    reason: str


# ---------------------------------------------------------------------------
# TTL probe cache
# ---------------------------------------------------------------------------


@dataclass
class _ProbeCache:
    available: bool
    checked_at: float  # time.monotonic()


_ollama_cache: _ProbeCache | None = None
_claude_cli_cache: _ProbeCache | None = None


async def _probe_ollama() -> bool:
    global _ollama_cache
    ttl = settings.PROVIDER_PROBE_TTL_SECONDS
    now = time.monotonic()
    if _ollama_cache is not None and (now - _ollama_cache.checked_at) < ttl:
        return _ollama_cache.available
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(f"{settings.OLLAMA_HOST}/api/tags")
            available = r.status_code == 200
    except Exception:
        available = False
    _ollama_cache = _ProbeCache(available=available, checked_at=now)
    if available:
        logger.info(
            "Ollama available at %s (model: %s)", settings.OLLAMA_HOST, settings.OLLAMA_MODEL
        )
    else:
        logger.warning("Ollama not reachable at %s", settings.OLLAMA_HOST)
    return available


_CLAUDE_AUTH_DIR = Path.home() / ".claude"


def _probe_claude_cli() -> bool:
    global _claude_cli_cache
    ttl = settings.PROVIDER_PROBE_TTL_SECONDS
    now = time.monotonic()
    if _claude_cli_cache is not None and (now - _claude_cli_cache.checked_at) < ttl:
        return _claude_cli_cache.available

    binary_found = shutil.which(settings.CLAUDE_CLI_PATH) is not None
    if not binary_found:
        logger.warning("Claude CLI binary not found at '%s'", settings.CLAUDE_CLI_PATH)
        _claude_cli_cache = _ProbeCache(available=False, checked_at=now)
        return False

    authenticated = _CLAUDE_AUTH_DIR.is_dir() and any(_CLAUDE_AUTH_DIR.glob("*.json"))
    if not authenticated:
        logger.warning(
            "Claude CLI found but not authenticated — run 'claude auth login' to sign in"
        )
    _claude_cli_cache = _ProbeCache(available=authenticated, checked_at=now)
    return authenticated


def _probe_nim() -> bool:
    """NIM is available if NIM_API_KEY is configured and NIM_ENABLED=true."""
    return bool(settings.NIM_API_KEY) and settings.NIM_ENABLED


# ---------------------------------------------------------------------------
# Per-agent defaults
# ---------------------------------------------------------------------------

AGENT_ROUTING: dict[str, tuple[Provider, TaskType]] = {
    "planner": (Provider.CLAUDE_CLI, TaskType.REASONING),
    "engineer": (Provider.OLLAMA, TaskType.FAST),
    "cost_estimator": (Provider.CLAUDE_CLI, TaskType.REASONING),
    "writer": (Provider.OLLAMA, TaskType.FAST),
}

# Kept for any legacy callers that only need the provider name
AGENT_PROVIDER_MAP: dict[str, Provider] = {
    name: routing[0] for name, routing in AGENT_ROUTING.items()
}


# ---------------------------------------------------------------------------
# Model factories
# ---------------------------------------------------------------------------


def _make_anthropic_model(task_type: TaskType) -> AnthropicModel:
    model_name = (
        settings.AI_REASONING_MODEL if task_type == TaskType.REASONING else settings.AI_FAST_MODEL
    )
    return AnthropicModel(model_name)


def _make_ollama_model() -> OpenAIModel:
    client = AsyncOpenAI(
        base_url=f"{settings.OLLAMA_HOST}/v1",
        api_key="ollama",
    )
    return OpenAIModel(settings.OLLAMA_MODEL, provider=OpenAIProvider(openai_client=client))


def _make_nim_model(model_name: str) -> OpenAIModel:
    client = AsyncOpenAI(
        base_url=settings.NIM_HOST,
        api_key=settings.NIM_API_KEY,
    )
    return OpenAIModel(model_name, provider=OpenAIProvider(openai_client=client))


def _anthropic_model_name(task_type: TaskType) -> str:
    return (
        settings.AI_REASONING_MODEL if task_type == TaskType.REASONING else settings.AI_FAST_MODEL
    )


# ---------------------------------------------------------------------------
# Core routing logic
# ---------------------------------------------------------------------------


async def resolve_routing(
    agent_name: str,
    mode: RoutingMode | None = None,
) -> RoutingDecision:
    """Resolve provider and model for an agent, respecting routing mode.

    For CLAUDE_CLI, model_name is empty — the CLI subprocess selects the model.
    """
    effective_mode = mode or RoutingMode(settings.ROUTING_MODE)
    preferred, task_type = AGENT_ROUTING.get(agent_name, (Provider.CLAUDE_CLI, TaskType.FAST))

    ollama_ok = await _probe_ollama()
    cli_ok = _probe_claude_cli()
    has_api_key = bool(settings.ANTHROPIC_API_KEY)

    # --- force_local ---
    if effective_mode == RoutingMode.FORCE_LOCAL:
        if not ollama_ok:
            raise RuntimeError(f"force_local: Ollama is not reachable at {settings.OLLAMA_HOST}")
        return RoutingDecision(Provider.OLLAMA, settings.OLLAMA_MODEL, False, "force_local")

    # --- force_cloud ---
    if effective_mode == RoutingMode.FORCE_CLOUD:
        if cli_ok:
            return RoutingDecision(Provider.CLAUDE_CLI, "", False, "force_cloud → claude_cli")
        if has_api_key:
            m = _anthropic_model_name(task_type)
            return RoutingDecision(Provider.ANTHROPIC, m, False, "force_cloud → anthropic_api")
        raise RuntimeError("force_cloud: Claude CLI not found and no ANTHROPIC_API_KEY configured")

    # --- prefer_local ---
    if effective_mode == RoutingMode.PREFER_LOCAL:
        if ollama_ok:
            return RoutingDecision(
                Provider.OLLAMA, settings.OLLAMA_MODEL, False, "prefer_local → ollama"
            )
        if cli_ok:
            return RoutingDecision(
                Provider.CLAUDE_CLI, "", True, "prefer_local → fallback to claude_cli"
            )
        if has_api_key:
            m = _anthropic_model_name(task_type)
            return RoutingDecision(
                Provider.ANTHROPIC, m, True, "prefer_local → fallback to anthropic_api"
            )
        raise RuntimeError("prefer_local: no provider is available")

    # --- prefer_cloud ---
    if effective_mode == RoutingMode.PREFER_CLOUD:
        if cli_ok:
            return RoutingDecision(Provider.CLAUDE_CLI, "", False, "prefer_cloud → claude_cli")
        if has_api_key:
            m = _anthropic_model_name(task_type)
            return RoutingDecision(Provider.ANTHROPIC, m, False, "prefer_cloud → anthropic_api")
        if ollama_ok:
            return RoutingDecision(
                Provider.OLLAMA, settings.OLLAMA_MODEL, True, "prefer_cloud → fallback to ollama"
            )
        raise RuntimeError("prefer_cloud: no provider is available")

    # --- auto ---
    # No API key: use CLI, NIM, or Ollama only
    if not has_api_key:
        nim_ok_early = _probe_nim()
        if (
            nim_ok_early
            and task_type == TaskType.FAST
            and not is_tech_locked("nim", settings.NIM_FAST_MODEL)
        ):
            return RoutingDecision(
                Provider.NIM, settings.NIM_FAST_MODEL, False, "auto: no_key → nim fast"
            )
        if preferred == Provider.OLLAMA and ollama_ok:
            return RoutingDecision(
                Provider.OLLAMA, settings.OLLAMA_MODEL, False, "auto: no_key, preferred=ollama"
            )
        if cli_ok:
            fallback = preferred != Provider.CLAUDE_CLI
            return RoutingDecision(Provider.CLAUDE_CLI, "", fallback, "auto: no_key → claude_cli")
        if ollama_ok:
            return RoutingDecision(
                Provider.OLLAMA, settings.OLLAMA_MODEL, True, "auto: no_key → ollama fallback"
            )
        raise RuntimeError(
            f"auto: no ANTHROPIC_API_KEY, Claude CLI not found at '{settings.CLAUDE_CLI_PATH}', Ollama unreachable"
        )

    # NIM gets priority for FAST tasks when available
    nim_ok = _probe_nim()
    if nim_ok and task_type == TaskType.FAST and not is_tech_locked("nim", settings.NIM_FAST_MODEL):
        return RoutingDecision(
            Provider.NIM, settings.NIM_FAST_MODEL, False, "auto: nim → fast task"
        )

    # Has API key: respect per-agent preference
    if preferred == Provider.CLAUDE_CLI and cli_ok:
        return RoutingDecision(Provider.CLAUDE_CLI, "", False, "auto: preferred=claude_cli")
    if preferred == Provider.OLLAMA and ollama_ok:
        return RoutingDecision(
            Provider.OLLAMA, settings.OLLAMA_MODEL, False, "auto: preferred=ollama"
        )
    if preferred == Provider.OLLAMA and not ollama_ok:
        if cli_ok:
            return RoutingDecision(Provider.CLAUDE_CLI, "", True, "auto: ollama down → claude_cli")
        m = _anthropic_model_name(task_type)
        return RoutingDecision(Provider.ANTHROPIC, m, True, "auto: ollama down → anthropic_api")

    m = _anthropic_model_name(task_type)
    return RoutingDecision(Provider.ANTHROPIC, m, False, "auto: anthropic_api")


# ---------------------------------------------------------------------------
# PydanticAI-compatible interface (used by existing pipeline agents)
# ---------------------------------------------------------------------------


async def get_model_for_agent(agent_name: str) -> tuple[Model, Provider]:
    """Return a PydanticAI Model + Provider for the given agent.

    For CLAUDE_CLI routing decisions, falls back to AnthropicModel so the
    existing pipeline agents (which use PydanticAI) keep working.
    Direct Claude CLI usage goes through ClaudeCliSession in services/claude_cli.py.
    """
    decision = await resolve_routing(agent_name)
    _, task_type = AGENT_ROUTING.get(agent_name, (Provider.CLAUDE_CLI, TaskType.FAST))

    if decision.provider == Provider.OLLAMA:
        return _make_ollama_model(), Provider.OLLAMA

    if decision.provider == Provider.NIM:
        nim_model = (
            settings.NIM_REASONING_MODEL
            if task_type == TaskType.REASONING
            else settings.NIM_FAST_MODEL
        )
        return _make_nim_model(nim_model), Provider.NIM

    # Both ANTHROPIC and CLAUDE_CLI return an AnthropicModel for PydanticAI compatibility
    return _make_anthropic_model(task_type), decision.provider


# ---------------------------------------------------------------------------
# Status + cache utilities
# ---------------------------------------------------------------------------


async def get_provider_status() -> dict[str, Any]:
    """Current availability of all providers — used by the /providers/status endpoint."""
    ollama_ok = await _probe_ollama()
    cli_ok = _probe_claude_cli()
    cli_installed = shutil.which(settings.CLAUDE_CLI_PATH) is not None
    cli_authenticated = _CLAUDE_AUTH_DIR.is_dir() and any(_CLAUDE_AUTH_DIR.glob("*.json"))
    return {
        "claude_cli": {
            "available": cli_ok,
            "installed": cli_installed,
            "authenticated": cli_authenticated,
            "path": settings.CLAUDE_CLI_PATH,
            "note": "Uses Claude Pro/Max subscription — no API credits needed",
        },
        "ollama": {
            "available": ollama_ok,
            "host": settings.OLLAMA_HOST,
            "model": settings.OLLAMA_MODEL,
        },
        "anthropic": {
            "available": bool(settings.ANTHROPIC_API_KEY),
            "reasoning_model": settings.AI_REASONING_MODEL,
            "fast_model": settings.AI_FAST_MODEL,
        },
        "nim": {
            "available": _probe_nim(),
            "host": settings.NIM_HOST,
            "fast_model": settings.NIM_FAST_MODEL,
            "reasoning_model": settings.NIM_REASONING_MODEL,
            "enabled": settings.NIM_ENABLED,
        },
    }


def reset_provider_cache() -> None:
    """Reset all TTL probe caches. Use in tests or after config changes."""
    global _ollama_cache, _claude_cli_cache
    _ollama_cache = None
    _claude_cli_cache = None
