"""Analytics service — aggregate stats from existing tables, no new DB tables."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.conversation import Conversation, Message
from app.db.models.task import Task


async def get_usage_stats(
    db: AsyncSession,
    *,
    user_id: str,
    workspace_id: str | None = None,
    days: int = 7,
) -> dict:
    since = datetime.now(UTC) - timedelta(days=days)

    # Conversations per day
    conv_q = (
        select(
            func.date(Conversation.created_at).label("day"),
            func.count().label("count"),
        )
        .where(Conversation.created_at >= since)
        .group_by(func.date(Conversation.created_at))
        .order_by(func.date(Conversation.created_at))
    )
    conv_result = await db.execute(conv_q)
    conversations_by_day = [
        {"date": str(r.day), "conversations": r.count} for r in conv_result
    ]

    # Total message count
    msg_q = select(func.count()).select_from(Message)
    total_messages = (await db.execute(msg_q)).scalar_one() or 0

    # Total conversations count
    total_conv = sum(r["conversations"] for r in conversations_by_day)

    # Tasks by step (workspace-scoped if provided)
    task_q = select(Task.step, func.count().label("count")).group_by(Task.step)
    if workspace_id:
        task_q = task_q.where(Task.workspace_id == workspace_id)  # type: ignore[arg-type]
    task_result = await db.execute(task_q)
    tasks_by_step = {r.step: r.count for r in task_result}

    tasks_done = tasks_by_step.get("done", 0)

    return {
        "conversations_by_day": conversations_by_day,
        "total_conversations": total_conv,
        "total_messages": total_messages,
        "tasks_by_step": tasks_by_step,
        "tasks_done": tasks_done,
        "period_days": days,
    }


async def get_task_stats(
    db: AsyncSession,
    *,
    workspace_id: str | None = None,
) -> dict:
    task_q = select(Task.step, func.count().label("count")).group_by(Task.step)
    if workspace_id:
        task_q = task_q.where(Task.workspace_id == workspace_id)  # type: ignore[arg-type]
    result = await db.execute(task_q)
    return {r.step: r.count for r in result}
