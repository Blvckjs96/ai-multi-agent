"""Analytics API — aggregate usage stats."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DBSession
from app.services import analytics as analytics_svc

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/usage")
async def get_usage(
    user: CurrentUser,
    db: DBSession,
    workspace_id: str | None = Query(default=None),
    period: int = Query(default=7, ge=1, le=90, description="Days to look back"),
) -> Any:
    return await analytics_svc.get_usage_stats(
        db,
        user_id=str(user.id),
        workspace_id=workspace_id,
        days=period,
    )


@router.get("/tasks")
async def get_task_distribution(
    user: CurrentUser,
    db: DBSession,
    workspace_id: str | None = Query(default=None),
) -> Any:
    return await analytics_svc.get_task_stats(db, workspace_id=workspace_id)
