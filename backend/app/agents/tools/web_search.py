"""Web search utility for agents using DuckDuckGo (no API key required).

duckduckgo-search is installed as part of pydantic-ai-slim[duckduckgo].
"""

import logging

logger = logging.getLogger(__name__)


async def web_search(query: str, *, max_results: int = 5) -> str:
    """Search the web using DuckDuckGo and return formatted results.

    Args:
        query: The search query string.
        max_results: Maximum number of results to return.

    Returns:
        Formatted string of search results, or empty string on failure.
    """
    try:
        from duckduckgo_search import DDGS  # type: ignore[import]

        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))

        if not results:
            return ""

        lines: list[str] = [f"Web search results for: {query}\n"]
        for i, r in enumerate(results, 1):
            title = r.get("title", "No title")
            href = r.get("href", "")
            body = r.get("body") or ""
            snippet = body[:300] + ("…" if len(body) > 300 else "")
            lines.append(f"{i}. {title}")
            if href:
                lines.append(f"   URL: {href}")
            if snippet:
                lines.append(f"   {snippet}")
            lines.append("")

        return "\n".join(lines)

    except ImportError:
        logger.warning("duckduckgo-search not installed; web search skipped")
        return ""
    except Exception as exc:
        logger.warning("Web search failed for %r: %s", query, exc)
        return ""
