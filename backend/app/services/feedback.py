from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.feedback import MessageFeedback
from app.repositories import feedback as feedback_repo


class FeedbackService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(
        self,
        *,
        conversation_id: str,
        message_id: str,
        user_id: str,
        rating: str,
        comment: str | None = None,
    ) -> MessageFeedback:
        return await feedback_repo.create_feedback(
            self.db,
            conversation_id=conversation_id,
            message_id=message_id,
            user_id=user_id,
            rating=rating,
            comment=comment,
        )

    async def get_by_message(self, message_id: str) -> list[MessageFeedback]:
        return await feedback_repo.get_by_message_id(self.db, message_id)
