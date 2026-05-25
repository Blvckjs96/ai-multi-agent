"""NVIDIA NIM model registry and fallback chain definitions.

All models listed here are confirmed free-endpoint (nim_type_preview) as of 2026-05.
Source: build.nvidia.com/models?filters=nimType%3Anim_type_preview

Verify exact model IDs on each model's "API" tab at build.nvidia.com before use.
Hot-swap primary models via NIM_FAST_MODEL / NIM_REASONING_MODEL in .env.
"""

from __future__ import annotations

from app.agents.pipeline.model_health import is_quality_deprioritized, is_tech_locked

# Free preview endpoint models — confirmed available 2026-05.
# IDs follow the publisher/model-slug convention shown on build.nvidia.com.
NIM_FREE_MODELS = [
    # Large reasoning / agentic
    "stepfun-ai/step-3.5-flash",               # 200B sparse MoE, reasoning + agentic
    "mistralai/mistral-large-3-675b-instruct-2512",  # 675B MoE, general language
    "minimax/minimax-m2.7",                    # 230B MoE, coding + reasoning + office
    "bytedance/seed-oss-36b-instruct",         # 36B, long-context, reasoning, agentic
    # Code-focused
    "qwen/qwen3-coder-480b-a35b-instruct",     # 480B MoE, agentic coding — best for engineer
    "abacus-ai/dracarys-llama-3.1-70b-instruct",  # 70B fine-tuned code + summarization
    "mistralai/mistral-nemotron",              # agentic, coding, function calling
    # Lighter fallbacks
    "meta/llama-4-maverick-17b-128e-instruct", # 17B MoE, multimodal, fast
    "nvidia/nemotron-mini-4b-instruct",        # 4B, RAG + function calling, lightest
]

# Role → ordered fallback chain: (provider_str, model_name)
# First non-locked entry wins. Ollama is always the last resort fallback.
NIM_ROLE_CHAINS: dict[str, list[tuple[str, str]]] = {
    "planner": [
        # Needs: structured decomposition, step-by-step reasoning, agentic planning
        ("nim", "stepfun-ai/step-3.5-flash"),
        ("nim", "minimax/minimax-m2.7"),
        ("nim", "bytedance/seed-oss-36b-instruct"),
        ("ollama", ""),  # model name filled from settings at runtime
    ],
    "engineer": [
        # Needs: code generation, architecture decisions, technical depth
        ("nim", "qwen/qwen3-coder-480b-a35b-instruct"),
        ("nim", "abacus-ai/dracarys-llama-3.1-70b-instruct"),
        ("nim", "mistralai/mistral-nemotron"),
        ("ollama", ""),
    ],
    "cost_estimator": [
        # Needs: structured output, arithmetic, instruction following
        ("nim", "mistralai/mistral-nemotron"),
        ("nim", "stepfun-ai/step-3.5-flash"),
        ("nim", "meta/llama-4-maverick-17b-128e-instruct"),
        ("ollama", ""),
    ],
    "writer": [
        # Needs: long-form prose, professional tone, language quality
        ("nim", "mistralai/mistral-large-3-675b-instruct-2512"),
        ("nim", "minimax/minimax-m2.7"),
        ("nim", "bytedance/seed-oss-36b-instruct"),
        ("ollama", ""),
    ],
}


def pick_healthy_model(role: str, ollama_model: str) -> tuple[str, str] | None:
    """Return first (provider, model) in role's chain that isn't locked.

    Returns None if all are locked. Healthy models come before deprioritized ones.
    Ollama placeholder gets filled with the current ollama_model setting.
    """
    chain = NIM_ROLE_CHAINS.get(role, [])
    healthy: list[tuple[str, str]] = []
    deprioritized: list[tuple[str, str]] = []

    for provider, model in chain:
        resolved_model = ollama_model if provider == "ollama" else model
        if is_tech_locked(provider, resolved_model):
            continue
        if is_quality_deprioritized(provider, resolved_model):
            deprioritized.append((provider, resolved_model))
        else:
            healthy.append((provider, resolved_model))

    candidates = healthy or deprioritized
    return candidates[0] if candidates else None
