"""Embedding model catalog with hardware requirements and recommendations.

All models are Ollama-compatible. Pull with: ollama pull <model_id>
Dimension must match the current pgvector schema (default: 768).
"""

from __future__ import annotations

from dataclasses import dataclass

from app.chiron.providers.hardware import HardwareInfo

# Dimension enforced by the pgvector migration (0005_pgvector.py).
# Switching to a different dimension requires running a new migration.
SCHEMA_EMBEDDING_DIM = 768


@dataclass
class EmbeddingModelSpec:
    id: str
    name: str
    dim: int
    size_gb: float
    ram_required_gb: float
    quality_score: int  # 1-10 — higher is better
    description: str
    ollama_pull: str

    @property
    def schema_compatible(self) -> bool:
        """True if this model fits in the current pgvector column (vector(768))."""
        return self.dim == SCHEMA_EMBEDDING_DIM


CATALOG: list[EmbeddingModelSpec] = [
    EmbeddingModelSpec(
        id="nomic-embed-text",
        name="Nomic Embed Text",
        dim=768,
        size_gb=0.27,
        ram_required_gb=1.0,
        quality_score=8,
        description="Best quality/size balance. Recommended for most systems. MTEB top-performer.",
        ollama_pull="ollama pull nomic-embed-text",
    ),
    EmbeddingModelSpec(
        id="nomic-embed-text:v1.5",
        name="Nomic Embed Text v1.5",
        dim=768,
        size_gb=0.27,
        ram_required_gb=1.0,
        quality_score=8,
        description="Improved version of nomic-embed-text with better multilingual support.",
        ollama_pull="ollama pull nomic-embed-text:v1.5",
    ),
    EmbeddingModelSpec(
        id="mxbai-embed-large",
        name="mxbai Embed Large",
        dim=1024,
        size_gb=0.67,
        ram_required_gb=2.0,
        quality_score=9,
        description="State-of-the-art retrieval quality. Requires schema migration (1024d).",
        ollama_pull="ollama pull mxbai-embed-large",
    ),
    EmbeddingModelSpec(
        id="all-minilm:l6-v2",
        name="All MiniLM L6 v2",
        dim=384,
        size_gb=0.05,
        ram_required_gb=0.5,
        quality_score=6,
        description="Minimal footprint (45 MB). Good for low-resource systems. Requires schema migration (384d).",
        ollama_pull="ollama pull all-minilm:l6-v2",
    ),
    EmbeddingModelSpec(
        id="snowflake-arctic-embed:m",
        name="Snowflake Arctic Embed M",
        dim=768,
        size_gb=0.27,
        ram_required_gb=1.0,
        quality_score=8,
        description="Strong retrieval performance, same footprint as nomic-embed-text.",
        ollama_pull="ollama pull snowflake-arctic-embed:m",
    ),
    EmbeddingModelSpec(
        id="bge-m3",
        name="BGE M3",
        dim=1024,
        size_gb=1.2,
        ram_required_gb=3.0,
        quality_score=9,
        description="Multilingual, multi-functionality embedding. Requires schema migration (1024d).",
        ollama_pull="ollama pull bge-m3",
    ),
]


def get_model(model_id: str) -> EmbeddingModelSpec | None:
    return next((m for m in CATALOG if m.id == model_id), None)


def recommend(
    hardware: HardwareInfo,
    installed_ids: list[str],
) -> list[dict]:
    """Return catalog sorted by fit, annotated with recommendation metadata."""
    results = []
    for model in CATALOG:
        fits_ram = hardware.ram_gb >= model.ram_required_gb
        is_installed = model.id in installed_ids
        schema_ok = model.schema_compatible

        if fits_ram and schema_ok:
            tier = "recommended"
        elif fits_ram and not schema_ok:
            tier = "needs_migration"
        elif not fits_ram:
            tier = "insufficient_ram"
        else:
            tier = "unavailable"

        results.append(
            {
                "id": model.id,
                "name": model.name,
                "dim": model.dim,
                "size_gb": model.size_gb,
                "ram_required_gb": model.ram_required_gb,
                "quality_score": model.quality_score,
                "description": model.description,
                "ollama_pull": model.ollama_pull,
                "schema_compatible": schema_ok,
                "fits_hardware": fits_ram,
                "is_installed": is_installed,
                "tier": tier,
            }
        )

    # Sort: recommended+installed first, then recommended, then needs_migration, then unavailable
    tier_order = {"recommended": 0, "needs_migration": 1, "insufficient_ram": 2, "unavailable": 3}
    results.sort(
        key=lambda m: (
            tier_order.get(m["tier"], 9),
            not m["is_installed"],
            -m["quality_score"],
        )
    )
    return results
