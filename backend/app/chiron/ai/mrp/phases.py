"""MRP phase LLM agents — one per phase, built with PydanticAI."""

from __future__ import annotations

import logging
import math
import re

from pydantic_ai import Agent

from app.chiron.ai.mrp.schemas import (
    ChunkExtract,
    MapOutput,
    ProposedPage,
    ReduceOutput,
    RefineOutput,
    TriageOutput,
)
from app.core.config import settings

logger = logging.getLogger(__name__)

_HAIKU = "anthropic:claude-haiku-4-5-20251001"
_SONNET = f"anthropic:{settings.PIPELINE_ANTHROPIC_MODEL or 'claude-sonnet-4-6'}"

# ---------------------------------------------------------------------------
# TRIAGE agent
# ---------------------------------------------------------------------------

_triage_agent: Agent[None, TriageOutput] = Agent(
    _HAIKU,
    output_type=TriageOutput,
    system_prompt=(
        "You are a document classifier for a knowledge base compiler. "
        "Classify the document and output structured JSON with doc_type, "
        "knowledge_type (human label), a 1-2 sentence summary, and up to 5 tags."
    ),
)


async def run_triage(content: str, file_path: str) -> TriageOutput:
    snippet = content[:4000]
    result = await _triage_agent.run(
        f"File: {file_path}\n\n---\n{snippet}\n---\nClassify this document."
    )
    return result.output


# ---------------------------------------------------------------------------
# MAP agent
# ---------------------------------------------------------------------------

_CHUNK_SIZE = 3000
_CHUNK_OVERLAP = 300


def _split_chunks(text: str) -> list[str]:
    """Split text into overlapping chunks for MAP phase."""
    if len(text) <= _CHUNK_SIZE:
        return [text]
    chunks: list[str] = []
    step = _CHUNK_SIZE - _CHUNK_OVERLAP
    for i in range(0, len(text), step):
        chunk = text[i : i + _CHUNK_SIZE]
        if chunk.strip():
            chunks.append(chunk)
    return chunks


_map_agent: Agent[None, MapOutput] = Agent(
    _HAIKU,
    output_type=MapOutput,
    system_prompt=(
        "You are a knowledge extraction assistant. Extract semantic chunks from the given text. "
        "Each chunk should cover one coherent concept, procedure, or topic. "
        "Keep chunks focused and self-contained. Include key entities and a one-sentence summary."
    ),
)


async def run_map(content: str) -> list[ChunkExtract]:
    """MAP phase: split content and extract semantic chunks from each split."""
    raw_splits = _split_chunks(content)
    all_chunks: list[ChunkExtract] = []

    for i, split in enumerate(raw_splits):
        try:
            result = await _map_agent.run(
                f"Extract knowledge chunks from this text segment ({i + 1}/{len(raw_splits)}):\n\n{split}"
            )
            all_chunks.extend(result.output.chunks)
        except Exception as exc:
            logger.warning("MAP phase chunk %d failed: %s", i, exc)
            # Fallback: create a plain chunk for the segment
            all_chunks.append(
                ChunkExtract(
                    title=f"Segment {i + 1}",
                    content=split[:2000],
                    entities=[],
                    summary=split[:200].replace("\n", " "),
                )
            )

    return all_chunks


# ---------------------------------------------------------------------------
# REDUCE agent
# ---------------------------------------------------------------------------

_reduce_agent: Agent[None, ReduceOutput] = Agent(
    _SONNET,
    output_type=ReduceOutput,
    system_prompt=(
        "You are a knowledge base editor. Given a list of semantic chunks from a document, "
        "synthesize them into well-structured wiki pages. "
        "Group related chunks into coherent pages. "
        "Each page should have a clear title, full Markdown content, a one-sentence summary, and tags. "
        "Aim for 2-6 pages unless the document is very large or very small. "
        "Reference source chunk indices in source_chunk_indices."
    ),
)


async def run_reduce(chunks: list[ChunkExtract], doc_type: str, file_path: str) -> list[ProposedPage]:
    """REDUCE phase: merge chunks into proposed wiki pages."""
    chunks_text = "\n\n".join(
        f"[Chunk {i}] {c.title}\n{c.content}" for i, c in enumerate(chunks)
    )
    # Truncate to avoid token limits
    if len(chunks_text) > 60_000:
        chunks_text = chunks_text[:60_000] + "\n...[truncated]"

    result = await _reduce_agent.run(
        f"Document: {file_path} (type: {doc_type})\n\nChunks:\n{chunks_text}\n\n"
        "Synthesize these chunks into wiki pages."
    )
    return result.output.pages


# ---------------------------------------------------------------------------
# REFINE agent
# ---------------------------------------------------------------------------

_refine_agent: Agent[None, RefineOutput] = Agent(
    _SONNET,
    output_type=RefineOutput,
    system_prompt=(
        "You are a technical writer improving wiki page quality. "
        "For each page: fix grammar, improve clarity, add missing context, "
        "ensure consistent Markdown formatting (headings, code blocks, lists), "
        "and add cross-references where relevant. "
        "Do NOT hallucinate facts not present in the original content."
    ),
)


async def run_refine(pages: list[ProposedPage]) -> list[ProposedPage]:
    """REFINE phase: polish proposed pages for wiki quality."""
    pages_text = "\n\n---\n\n".join(
        f"# {p.title}\n\n{p.content}" for p in pages
    )
    if len(pages_text) > 50_000:
        pages_text = pages_text[:50_000] + "\n...[truncated]"

    result = await _refine_agent.run(
        f"Improve these {len(pages)} proposed wiki pages:\n\n{pages_text}"
    )
    refined = result.output.pages

    # Preserve source_chunk_indices from original if refiner drops them
    for i, page in enumerate(refined):
        if i < len(pages) and not page.source_chunk_indices:
            page.source_chunk_indices = pages[i].source_chunk_indices

    return refined
