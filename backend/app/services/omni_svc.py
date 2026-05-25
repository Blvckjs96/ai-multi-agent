"""OMNI UI/UX skill service — optional HTTP client for the OMNI adapter.

When OMNI_URL is set, the Engineer agent can request merged UI/UX skill
guidance before designing a frontend architecture. Disabled by default
(OMNI_URL = "") so existing non-UI pipelines are unaffected.

Endpoints expected from the OMNI adapter:
  GET  /omni/health           → {"ok": true, "skills": N}
  POST /omni/generate         → OmniGenerateResponse
"""

from __future__ import annotations

import logging
import re as _re
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_TIMEOUT = 8.0  # seconds — OMNI does BM25 search, give it time

_UI_KEYWORDS: frozenset[str] = frozenset(
    {
        "ui", "ux", "frontend", "front-end", "design", "component",
        "dashboard", "interface", "landing page", "screen", "layout",
        "button", "modal", "navbar", "sidebar", "chart", "datatable",
        "animation", "responsive", "mobile app", "web app", "stylesheet",
        "css", "tailwind", "figma", "wireframe", "prototype", "pixel",
    }
)

# Whole-word pattern — matched against individual tokens, not arbitrary substrings.
_TOKEN_RE = _re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")


def _is_ui_task(description: str) -> bool:
    """Heuristic: return True if the description involves UI/frontend work.

    Uses whole-word token matching to avoid false positives like
    'form' in 'performance' or 'ui' in 'build'.
    Multi-word phrases (e.g. 'landing page') are checked against the full
    lowercased string after single-word tokens are exhausted.
    """
    lower = description.lower()

    # Single-word keywords: match only whole tokens
    tokens = set(_TOKEN_RE.findall(lower))
    single_kw = {kw for kw in _UI_KEYWORDS if " " not in kw and "-" not in kw}
    hyphen_kw = {kw for kw in _UI_KEYWORDS if "-" in kw}
    phrase_kw = {kw for kw in _UI_KEYWORDS if " " in kw}

    if tokens & single_kw:
        return True
    # Hyphenated keywords: treat each hyphenated form as one token
    if tokens & hyphen_kw:
        return True
    # Multi-word phrases: substring match is acceptable since they're specific enough
    return any(phrase in lower for phrase in phrase_kw)


class OmniService:
    """Thin async HTTP client for the OMNI skill adapter."""

    async def is_healthy(self) -> bool:
        if not settings.OMNI_URL:
            return False
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                r = await client.get(f"{settings.OMNI_URL}/omni/health")
                return r.is_success
        except Exception:
            return False

    async def get_ui_guidance(
        self,
        task: str,
        *,
        stack: str = "React + TypeScript",
        style_direction: str | None = None,
        brand_reference: str | None = None,
        max_skills: int = 4,
    ) -> str | None:
        """Return merged OMNI skill guidance for a UI task.

        Returns the implementation_prompt string (up to ~2000 tokens of
        curated skill content + brand tokens) or None if OMNI is unavailable
        or the task is not UI-related.
        """
        if not settings.OMNI_URL or not _is_ui_task(task):
            return None

        payload: dict[str, Any] = {
            "task": task,
            "stack": stack,
            "max_skills": max_skills,
        }
        if style_direction:
            payload["style_direction"] = style_direction
        if brand_reference:
            payload["brand_reference"] = brand_reference

        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                r = await client.post(
                    f"{settings.OMNI_URL}/omni/generate",
                    json=payload,
                )
                if not r.is_success:
                    logger.debug("OMNI /omni/generate returned %d", r.status_code)
                    return None
                data = r.json()
                prompt: str = data.get("implementation_prompt", "")
                return prompt[:3000] if prompt else None
        except httpx.TimeoutException:
            logger.debug("OMNI request timed out for task: %s", task[:80])
            return None
        except Exception as exc:
            logger.debug("OMNI request failed (non-fatal): %s", exc)
            return None


# Module-level singleton.
omni_svc = OmniService()
