from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.feedback import MessageFeedback


async def create_feedback(
    db: AsyncSession,
    *,
    conversation_id: str,
    message_id: str,
    user_id: str,
    rating: str,
    comment: str | None = None,
) -> MessageFeedback:
    fb = MessageFeedback(
        conversation_id=str(conversation_id),
        message_id=str(message_id),
        user_id=str(user_id),
        rating=rating,
        comment=comment,
    )
    db.add(fb)
    await db.flush()
    await db.refresh(fb)
    return fb


async def get_by_message_id(db: AsyncSession, message_id: str) -> list[MessageFeedback]:
    result = await db.execute(
        select(MessageFeedback).where(MessageFeedback.message_id == message_id)
    )
    return list(result.scalars().all())


async def get_by_conversation_id(
    db: AsyncSession, conversation_id: str
) -> list[MessageFeedback]:
    result = await db.execute(
        select(MessageFeedback).where(MessageFeedback.conversation_id == conversation_id)
    )
    return list(result.scalars().all())
