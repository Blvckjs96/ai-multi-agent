"""GitHub OAuth + API service."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_GH_API = "https://api.github.com"
_GH_OAUTH_TOKEN = "https://github.com/login/oauth/access_token"  # nosec B105


class GitHubService:
    """Wraps GitHub OAuth 2.0 and REST API v3."""

    def __init__(self, access_token: str | None = None) -> None:
        self._token = access_token

    # ── OAuth ─────────────────────────────────────────────────────────────────

    @staticmethod
    def get_auth_url(state: str) -> str:
        """Build the GitHub OAuth authorisation URL."""
        client_id = settings.GITHUB_CLIENT_ID
        redirect = settings.GITHUB_REDIRECT_URI
        scopes = "repo,read:user"
        return (
            f"https://github.com/login/oauth/authorize"
            f"?client_id={client_id}&redirect_uri={redirect}"
            f"&scope={scopes}&state={state}"
        )

    @staticmethod
    async def exchange_code(code: str) -> str:
        """Exchange an OAuth code for an access token."""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                _GH_OAUTH_TOKEN,
                data={
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": settings.GITHUB_REDIRECT_URI,
                },
                headers={"Accept": "application/json"},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            token = data.get("access_token")
            if not token:
                raise ValueError(f"GitHub OAuth failed: {data.get('error_description', data)}")
            return token

    # ── API helpers ───────────────────────────────────────────────────────────

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    async def _get(self, path: str, params: dict | None = None) -> Any:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{_GH_API}{path}",
                headers=self._headers(),
                params=params or {},
                timeout=10,
            )
            resp.raise_for_status()
            return resp.json()

    # ── User & repos ──────────────────────────────────────────────────────────

    async def get_user(self) -> dict[str, Any]:
        return await self._get("/user")

    async def list_repos(self, page: int = 1, per_page: int = 30) -> list[dict[str, Any]]:
        return await self._get(
            "/user/repos", {"sort": "updated", "page": page, "per_page": per_page}
        )

    async def list_branches(self, owner: str, repo: str) -> list[dict[str, Any]]:
        return await self._get(f"/repos/{owner}/{repo}/branches")

    async def list_pull_requests(
        self, owner: str, repo: str, state: str = "open"
    ) -> list[dict[str, Any]]:
        return await self._get(f"/repos/{owner}/{repo}/pulls", {"state": state, "per_page": 30})

    async def get_pr_diff(self, owner: str, repo: str, pr_number: int) -> str:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{_GH_API}/repos/{owner}/{repo}/pulls/{pr_number}",
                headers={**self._headers(), "Accept": "application/vnd.github.diff"},
                timeout=15,
            )
            resp.raise_for_status()
            return resp.text

    async def list_commits(
        self, owner: str, repo: str, branch: str = "main", per_page: int = 20
    ) -> list[dict[str, Any]]:
        return await self._get(
            f"/repos/{owner}/{repo}/commits",
            {"sha": branch, "per_page": per_page},
        )
