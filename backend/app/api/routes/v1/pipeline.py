"""Pipeline SSE endpoint — no auth required (portfolio demo)."""

import logging

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.agents.pipeline.runner import run_pipeline

logger = logging.getLogger(__name__)

router = APIRouter()


class PipelineRequest(BaseModel):
    """Request body for the pipeline run endpoint."""

    description: str = Field(
        description="Plain-English description of the project to spec out",
        min_length=10,
        max_length=4000,
    )


@router.post("/pipeline/run")
async def run_pipeline_endpoint(request: PipelineRequest) -> StreamingResponse:
    """Run the four-agent pipeline and stream events via SSE.

    No authentication required — this is a public portfolio demo endpoint.

    Events (newline-delimited JSON prefixed with 'data: '):
    - {"type": "agent_start",  "agent": "planner|engineer|cost_estimator|writer"}
    - {"type": "agent_done",   "agent": "...", "result": {...}}
    - {"type": "complete",     "spec": "<markdown>"}
    - {"type": "error",        "message": "..."}
    """
    logger.info(
        "Pipeline run started. Description length: %d chars",
        len(request.description),
    )

    return StreamingResponse(
        run_pipeline(request.description),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
