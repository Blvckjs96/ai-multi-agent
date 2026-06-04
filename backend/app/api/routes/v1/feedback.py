from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Query, status
from pydantic import BaseModel, ConfigDict, field_validator

from app.api.deps import CurrentUser, DBSession
from app.repositories import feedback as feedback_repo

router = APIRouter()


class FeedbackRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: str
    message_id: str
    user_id: str
    rating: str
    comment: str | None = None


class FeedbackList(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: list[FeedbackRead]
    total: int
    positive: int
    negative: int


class FeedbackCreate(BaseModel):
    conversation_id: str
    message_id: str
    rating: str
    comment: str | None = None

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: str) -> str:
        if v not in ("up", "down"):
            raise ValueError("rating must be 'up' or 'down'")
        return v


@router.get("", response_model=FeedbackList)
async def list_feedback(
    user: CurrentUser,
    db: DBSession,
    rating: str | None = Query(default=None, description="Filter by 'up' or 'down'"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> Any:
    items, total = await feedback_repo.get_all_by_user(
        db, user_id=str(user.id), rating=rating, skip=skip, limit=limit
    )
    positive = sum(1 for fb in items if fb.rating == "up")
    negative = sum(1 for fb in items if fb.rating == "down")
    return FeedbackList(items=items, total=total, positive=positive, negative=negative)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_feedback(
    body: FeedbackCreate,
    user: CurrentUser,
    db: DBSession,
) -> Any:
    return await feedback_repo.create_feedback(
        db,
        conversation_id=body.conversation_id,
        message_id=body.message_id,
        user_id=str(user.id),
        rating=body.rating,
        comment=body.comment,
    )
