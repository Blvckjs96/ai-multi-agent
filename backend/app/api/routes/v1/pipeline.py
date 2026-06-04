"""Pipeline SSE endpoint — no auth required (portfolio demo)."""

import logging

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

from app.agents.pipeline.runner import run_pipeline
from app.api.deps import ValidAPIKey

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
@limiter.limit("20/minute")
async def run_pipeline_endpoint(
    request: Request, body: PipelineRequest, api_key: ValidAPIKey
) -> StreamingResponse:
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
        len(body.description),
    )

    return StreamingResponse(
        run_pipeline(body.description),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
