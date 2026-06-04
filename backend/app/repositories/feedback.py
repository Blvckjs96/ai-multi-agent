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


async def get_all_by_user(
    db: AsyncSession,
    *,
    user_id: str,
    rating: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[MessageFeedback], int]:
    q = select(MessageFeedback).where(MessageFeedback.user_id == user_id)
    if rating:
        q = q.where(MessageFeedback.rating == rating)
    q = q.order_by(MessageFeedback.created_at.desc())

    count_q = select(MessageFeedback).where(MessageFeedback.user_id == user_id)
    if rating:
        count_q = count_q.where(MessageFeedback.rating == rating)
    total = len(list((await db.execute(count_q)).scalars().all()))

    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    return list(result.scalars().all()), total
