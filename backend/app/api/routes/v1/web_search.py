"""Web search endpoint.

GET /web-search?q=...&limit=5&provider=duckduckgo
"""

from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser
from app.services.web_search import search as web_search_svc

router = APIRouter(prefix="/web-search", tags=["web-search"])


@router.get("")
async def search_web(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(5, ge=1, le=10, description="Max results"),
    user: CurrentUser = None,
) -> Any:
    results = await web_search_svc(q, limit)
    return {
        "results": results,
        "query": q,
        "provider": os.getenv("WEB_SEARCH_PROVIDER", "duckduckgo"),
    }
