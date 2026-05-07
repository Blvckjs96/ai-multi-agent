"""Model router — rotates pipeline agents between Anthropic and Ollama providers.

Rotation strategy (alternating by agent role):
  Planner       → Anthropic  (strict JSON, needs reliability)
  Engineer      → Ollama     (large model, broad tech knowledge)
  Cost Estimator→ Anthropic  (precise USD figures)
  Writer        → Ollama     (large model, long-form prose)

If Ollama is unavailable, all agents fall back to Anthropic.
"""

from __future__ import annotations

import logging
from enum import Enum
from typing import TYPE_CHECKING

import httpx
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.openai import OpenAIModel
from openai import AsyncOpenAI

from app.core.config import settings

if TYPE_CHECKING:
    from pydantic_ai.models import Model

logger = logging.getLogger(__name__)


class Provider(str, Enum):
    ANTHROPIC = "anthropic"
    OLLAMA = "ollama"


# Fixed rotation: each agent slot maps to a preferred provider
AGENT_PROVIDER_MAP: dict[str, Provider] = {
    "planner": Provider.ANTHROPIC,
    "engineer": Provider.OLLAMA,
    "cost_estimator": Provider.ANTHROPIC,
    "writer": Provider.OLLAMA,
}

_ollama_available: bool | None = None  # cached after first check


async def _check_ollama() -> bool:
    """Return True if the Ollama server responds on the configured host."""
    global _ollama_available
    if _ollama_available is not None:
        return _ollama_available
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(f"{settings.OLLAMA_HOST}/api/tags")
            _ollama_available = r.status_code == 200
    except Exception:
        _ollama_available = False
    if not _ollama_available:
        logger.warning(
            "Ollama not reachable at %s — all agents will use Anthropic",
            settings.OLLAMA_HOST,
        )
    else:
        logger.info(
            "Ollama available at %s (model: %s)",
            settings.OLLAMA_HOST,
            settings.OLLAMA_MODEL,
        )
    return _ollama_available


def _make_anthropic_model() -> AnthropicModel:
    return AnthropicModel(settings.PIPELINE_ANTHROPIC_MODEL)


def _make_ollama_model() -> OpenAIModel:
    client = AsyncOpenAI(
        base_url=f"{settings.OLLAMA_HOST}/v1",
        api_key="ollama",  # Ollama ignores this but the SDK requires it
    )
    return OpenAIModel(settings.OLLAMA_MODEL, openai_client=client)


async def get_model_for_agent(agent_name: str) -> tuple["Model", Provider]:
    """Return the appropriate model and provider for the given agent.

    Falls back to Anthropic if Ollama is unavailable or if the agent
    is not in the rotation map.

    Args:
        agent_name: One of 'planner', 'engineer', 'cost_estimator', 'writer'.

    Returns:
        Tuple of (pydantic_ai Model instance, Provider enum value used).
    """
    preferred = AGENT_PROVIDER_MAP.get(agent_name, Provider.ANTHROPIC)

    if preferred == Provider.OLLAMA:
        if await _check_ollama():
            return _make_ollama_model(), Provider.OLLAMA
        logger.warning("Ollama unavailable — %s falling back to Anthropic", agent_name)

    return _make_anthropic_model(), Provider.ANTHROPIC


def reset_ollama_cache() -> None:
    """Reset the Ollama availability cache (useful for tests)."""
    global _ollama_available
    _ollama_available = None
