"""Task Triage endpoint.

POST /triage/analyze  → run the 3-layer triage pipeline and return the
                        TriageResult that would be sent to Claude CLI.

Useful for the frontend to show the user which tools/skills were selected
before the message is sent, and for debugging triage accuracy.
"""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.triage import TaskTriageService

router = APIRouter(prefix="/triage", tags=["triage"])

_svc = TaskTriageService()


class TriageRequest(BaseModel):
    message: str


class TriageResponse(BaseModel):
    allowed_tools: list[str]
    mcp_servers: dict[str, Any]
    skills: list[str]
    model: str
    effort: str


@router.post("/analyze", response_model=TriageResponse)
async def analyze_task(body: TriageRequest) -> Any:
    """Classify a message and return the triage metadata.

    The response matches the shape of TriageResult from claude_cli.py.
    """
    result = await _svc.analyze(body.message)
    return TriageResponse(
        allowed_tools=result.allowed_tools,
        mcp_servers=result.mcp_servers,
        skills=result.skills,
        model=result.model,
        effort=result.effort,
    )
