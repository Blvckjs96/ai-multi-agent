"""GitHub OAuth + API proxy endpoints."""

from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.api.deps import ValidAPIKey
from app.services.github_svc import GitHubService

router = APIRouter(prefix="/github", tags=["github"])


class OAuthCallbackRequest(BaseModel):
    code: str
    state: str | None = None


class TokenResponse(BaseModel):
    access_token: str


@router.get("/auth/url")
async def get_auth_url(api_key: ValidAPIKey, state: str = Query(default="")) -> Any:
    url = GitHubService.get_auth_url(state)
    return {"url": url}


@router.post("/auth/callback", response_model=TokenResponse)
async def oauth_callback(body: OAuthCallbackRequest, api_key: ValidAPIKey) -> Any:
    token = await GitHubService.exchange_code(body.code)
    return {"access_token": token}


@router.get("/user")
async def get_user(api_key: ValidAPIKey, access_token: str = Query(...)) -> Any:
    return await GitHubService(access_token).get_user()


@router.get("/repos")
async def list_repos(
    api_key: ValidAPIKey,
    access_token: str = Query(...),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=30, ge=1, le=100),
) -> Any:
    return await GitHubService(access_token).list_repos(page=page, per_page=per_page)


@router.get("/repos/{owner}/{repo}/branches")
async def list_branches(
    owner: str, repo: str, api_key: ValidAPIKey, access_token: str = Query(...)
) -> Any:
    return await GitHubService(access_token).list_branches(owner, repo)


@router.get("/repos/{owner}/{repo}/pulls")
async def list_pull_requests(
    owner: str,
    repo: str,
    api_key: ValidAPIKey,
    access_token: str = Query(...),
    state: str = Query(default="open"),
) -> Any:
    return await GitHubService(access_token).list_pull_requests(owner, repo, state=state)


@router.get("/repos/{owner}/{repo}/pulls/{pr_number}/diff")
async def get_pr_diff(
    owner: str, repo: str, pr_number: int, api_key: ValidAPIKey, access_token: str = Query(...)
) -> Any:
    diff = await GitHubService(access_token).get_pr_diff(owner, repo, pr_number)
    return {"diff": diff}


@router.get("/repos/{owner}/{repo}/commits")
async def list_commits(
    owner: str,
    repo: str,
    api_key: ValidAPIKey,
    access_token: str = Query(...),
    branch: str = Query(default="main"),
    per_page: int = Query(default=20, ge=1, le=100),
) -> Any:
    return await GitHubService(access_token).list_commits(
        owner, repo, branch=branch, per_page=per_page
    )
