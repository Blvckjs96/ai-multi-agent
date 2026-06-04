"""Multi-provider web search service.

Provider selected via WEB_SEARCH_PROVIDER env var.
Supported: duckduckgo (default, no key), brave (needs key), searxng (self-hosted).
"""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)


async def search(query: str, limit: int = 5) -> list[dict[str, Any]]:
    provider = os.getenv("WEB_SEARCH_PROVIDER", "duckduckgo").lower()
    try:
        if provider == "searxng":
            return await _searxng(query, limit)
        elif provider == "brave":
            return await _brave(query, limit)
        else:
            return await _duckduckgo(query, limit)
    except Exception as exc:
        logger.warning("Web search failed (provider=%s): %s", provider, exc)
        return []


async def _duckduckgo(query: str, limit: int) -> list[dict[str, Any]]:
    """DuckDuckGo instant answer API — free, no key required."""
    async with httpx.AsyncClient(timeout=8) as client:
        r = await client.get(
            "https://api.duckduckgo.com/",
            params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1},
        )
        data = r.json()

    results: list[dict[str, Any]] = []

    # Abstract / instant answer
    if data.get("AbstractText"):
        results.append(
            {
                "title": data.get("Heading", query),
                "url": data.get("AbstractURL", ""),
                "snippet": data["AbstractText"],
            }
        )

    for item in data.get("RelatedTopics", []):
        if len(results) >= limit:
            break
        if "Text" in item and "FirstURL" in item:
            results.append(
                {
                    "title": item["Text"][:100],
                    "url": item["FirstURL"],
                    "snippet": item["Text"],
                }
            )

    return results[:limit]


async def _brave(query: str, limit: int) -> list[dict[str, Any]]:
    api_key = os.getenv("WEB_SEARCH_BRAVE_API_KEY", "")
    if not api_key:
        logger.warning("Brave search selected but WEB_SEARCH_BRAVE_API_KEY is not set")
        return []
    async with httpx.AsyncClient(timeout=8) as client:
        r = await client.get(
            "https://api.search.brave.com/res/v1/web/search",
            params={"q": query, "count": limit},
            headers={"Accept": "application/json", "X-Subscription-Token": api_key},
        )
        data = r.json()
    return [
        {
            "title": i.get("title", ""),
            "url": i.get("url", ""),
            "snippet": i.get("description", ""),
        }
        for i in data.get("web", {}).get("results", [])[:limit]
    ]


async def _searxng(query: str, limit: int) -> list[dict[str, Any]]:
    base = os.getenv("WEB_SEARCH_SEARXNG_URL", "http://localhost:8080")
    async with httpx.AsyncClient(timeout=8) as client:
        r = await client.get(
            f"{base}/search",
            params={"q": query, "format": "json", "pageno": 1},
        )
        data = r.json()
    return [
        {
            "title": i.get("title", ""),
            "url": i.get("url", ""),
            "snippet": i.get("content", ""),
        }
        for i in data.get("results", [])[:limit]
    ]
