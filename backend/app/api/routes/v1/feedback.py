from __future__ import annotations

from typing import Any

from fastapi import APIRouter, status
from pydantic import BaseModel, field_validator

from app.api.deps import CurrentUser, DBSession
from app.repositories import feedback as feedback_repo

router = APIRouter()


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
