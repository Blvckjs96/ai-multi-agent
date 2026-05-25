"""Pydantic schemas for MRP pipeline phase inputs/outputs."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class TriageOutput(BaseModel):
    doc_type: Literal["spec", "api", "guide", "code", "design", "meeting", "other"]
    knowledge_type: str = Field(description="Short human-readable label, e.g. 'API Reference'")
    summary: str = Field(description="1-2 sentence summary of the document")
    suggested_tags: list[str] = Field(default_factory=list)


class ChunkExtract(BaseModel):
    title: str = Field(description="Short descriptive title for this chunk")
    content: str = Field(description="The chunk content, cleaned and trimmed")
    entities: list[str] = Field(default_factory=list, description="Key entities mentioned")
    summary: str = Field(description="One sentence summary of this chunk")


class MapOutput(BaseModel):
    chunks: list[ChunkExtract]


class ProposedPage(BaseModel):
    title: str = Field(description="Wiki page title")
    content: str = Field(description="Full wiki page content in Markdown")
    summary: str = Field(description="One sentence summary")
    tags: list[str] = Field(default_factory=list)
    source_chunk_indices: list[int] = Field(
        default_factory=list, description="Indices of source chunks this page draws from"
    )


class ReduceOutput(BaseModel):
    pages: list[ProposedPage]


class RefineOutput(BaseModel):
    pages: list[ProposedPage]
