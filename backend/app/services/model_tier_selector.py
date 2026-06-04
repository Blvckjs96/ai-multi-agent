"""ArgoHarness Model Tier Selector.

Selects the best local Ollama model for a given task based on triage metadata
and (optionally) a user-specified override from the UI.

Tier system:
  Tier 0 — qwen2.5:0.5b       Ultra-fast scorer / judge. Never used for coding.
  Tier 1 — qwen2.5-coder:3b   Fast Q&A, explain, read-only, simple edits.
  Tier 2 — gemma4:31b-cloud   Complex coding. 262K context, native tools, thinking.

Selection logic (auto mode):
  • Any write tool (Write/Edit/Bash) OR effort=high OR context_chars>8000 → Tier 2
  • Read-only + haiku tier OR simple message                               → Tier 1
  • Default                                                                → Tier 1

User override: if the user selects a model in the UI, it is respected as long
as the model appears in _KNOWN_MODELS (prevents arbitrary injection). Unknown
override names are logged and ignored.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from app.core.config import settings
from app.services.claude_cli import TriageResult

logger = logging.getLogger(__name__)

_WRITE_TOOLS: frozenset[str] = frozenset({"Write", "Edit", "MultiEdit", "Bash"})


# ---------------------------------------------------------------------------
# Model catalog (shown in UI + used for tier selection)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ModelSpec:
    tier: int
    context_window: int
    supports_thinking: bool
    label: str


# All models Argo knows about for local execution.
# Add entries here when new models are installed — the UI auto-discovers them.
_KNOWN_MODELS: dict[str, ModelSpec] = {
    "qwen2.5:0.5b": ModelSpec(
        tier=0, context_window=32_768, supports_thinking=False,
        label="Qwen2.5 0.5B (judge only)",
    ),
    "qwen2.5-coder:3b": ModelSpec(
        tier=1, context_window=32_768, supports_thinking=False,
        label="Qwen2.5-Coder 3B · Fast",
    ),
    "qwen2.5-coder:7b": ModelSpec(
        tier=1, context_window=32_768, supports_thinking=False,
        label="Qwen2.5-Coder 7B · Balanced",
    ),
    "qwen2.5-coder:14b": ModelSpec(
        tier=1, context_window=32_768, supports_thinking=False,
        label="Qwen2.5-Coder 14B · Better",
    ),
    "qwen2.5-coder:32b": ModelSpec(
        tier=2, context_window=32_768, supports_thinking=False,
        label="Qwen2.5-Coder 32B · Strong",
    ),
    "qwen2.5:7b-instruct": ModelSpec(
        tier=1, context_window=32_768, supports_thinking=False,
        label="Qwen2.5 7B Instruct",
    ),
    "gemma4:31b-cloud": ModelSpec(
        tier=2, context_window=262_144, supports_thinking=True,
        label="Gemma4 31B · 262K ctx · Thinking",
    ),
    "gemma4:e4b": ModelSpec(
        tier=1, context_window=131_072, supports_thinking=True,
        label="Gemma4 E4B · Efficient",
    ),
    "deepseek-coder:6.7b": ModelSpec(
        tier=1, context_window=16_384, supports_thinking=False,
        label="DeepSeek-Coder 6.7B",
    ),
    "deepseek-r1:latest": ModelSpec(
        tier=2, context_window=65_536, supports_thinking=True,
        label="DeepSeek-R1 · Reasoning",
    ),
    "llama3.1:latest": ModelSpec(
        tier=1, context_window=131_072, supports_thinking=False,
        label="Llama3.1 8B",
    ),
    "codellama:latest": ModelSpec(
        tier=1, context_window=16_384, supports_thinking=False,
        label="CodeLlama",
    ),
    "phi4-mini:latest": ModelSpec(
        tier=1, context_window=131_072, supports_thinking=False,
        label="Phi-4 Mini",
    ),
    "omni-coder:latest": ModelSpec(
        tier=1, context_window=32_768, supports_thinking=False,
        label="Omni-Coder",
    ),
}


# ---------------------------------------------------------------------------
# Selection result
# ---------------------------------------------------------------------------

@dataclass
class ModelTierSelection:
    model_id: str
    tier: int
    context_window: int
    supports_thinking: bool
    label: str
    source: str   # "auto" | "user_override" | "config"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def select_model_tier(
    triage: TriageResult,
    context_chars: int = 0,
    user_override: str | None = None,
) -> ModelTierSelection:
    """Return the best model for this triage + optional user override.

    Args:
        triage:        Routing metadata from the triage service.
        context_chars: Estimated system prompt size in chars (≈ tokens * 4).
        user_override: Model ID chosen by the user in the UI. Validated against
                       _KNOWN_MODELS; ignored if not found.
    """
    # User override — validate and use if known
    if user_override:
        spec = _KNOWN_MODELS.get(user_override)
        if spec and spec.tier > 0:  # exclude judge-only tier 0
            logger.info("model_tier: user_override=%s (tier %d)", user_override, spec.tier)
            return _make_selection(user_override, spec, source="user_override")
        elif spec and spec.tier == 0:
            logger.warning(
                "model_tier: user_override=%s is tier-0 (judge only) — ignoring", user_override
            )
        else:
            logger.warning("model_tier: unknown user_override=%s — ignoring", user_override)

    # Auto selection
    tool_set = set(triage.allowed_tools)
    has_write = bool(_WRITE_TOOLS & tool_set)
    large_context = context_chars > 8_000
    is_complex = triage.effort == "high" or (has_write and len(tool_set) >= 4)
    is_simple = triage.model == "haiku" and not has_write

    if is_complex or large_context:
        # Tier 2 — Gemma4 for maximum quality + context
        model_id = settings.OLLAMA_TIER2_MODEL
    elif is_simple:
        # Tier 1 — fast model for simple tasks
        model_id = settings.OLLAMA_TIER1_MODEL
    else:
        # Default: Tier 1
        model_id = settings.OLLAMA_TIER1_MODEL

    spec = _KNOWN_MODELS.get(model_id)
    if spec is None:
        # Config references an unknown model — use a safe default spec
        logger.warning("model_tier: config model %r not in _KNOWN_MODELS — using defaults", model_id)
        spec = ModelSpec(tier=1, context_window=32_768, supports_thinking=False, label=model_id)

    logger.info(
        "model_tier: auto → %s (tier %d) — has_write=%s complex=%s large_ctx=%s",
        model_id, spec.tier, has_write, is_complex, large_context,
    )
    return _make_selection(model_id, spec, source="auto")


def get_model_catalog() -> list[dict]:
    """Return all known models as dicts for the frontend model selector."""
    return [
        {
            "id": model_id,
            "tier": spec.tier,
            "context_window": spec.context_window,
            "supports_thinking": spec.supports_thinking,
            "label": spec.label,
        }
        for model_id, spec in _KNOWN_MODELS.items()
        if spec.tier > 0  # exclude judge-only models from the UI
    ]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_selection(model_id: str, spec: ModelSpec, source: str) -> ModelTierSelection:
    return ModelTierSelection(
        model_id=model_id,
        tier=spec.tier,
        context_window=spec.context_window,
        supports_thinking=spec.supports_thinking,
        label=spec.label,
        source=source,
    )
