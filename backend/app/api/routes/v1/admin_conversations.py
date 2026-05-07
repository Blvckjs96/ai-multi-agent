"""Admin conversation and user browsing routes.

All endpoints require admin role.

Endpoints:
    GET  /admin/conversations           — List all conversations (paginated, filterable)
    GET  /admin/conversations/{id}      — Get any conversation with messages (read-only)
    GET  /admin/users                   — List all users with conversation counts
    GET  /admin/users/{user_id}/conversations — List conversations for a specific user
"""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Query

from app.api.deps import ConversationSvc, CurrentAdmin
from app.schemas.conversation import ConversationReadWithMessages
from app.schemas.conversation_share import (
    AdminConversationList,
    AdminConversationRead,
    AdminUserList,
)

router = APIRouter()


@router.get("", response_model=AdminConversationList)
async def admin_list_conversations(
    service: ConversationSvc,
    current_user: CurrentAdmin,
    skip: int = Query(0, ge=0, description="Items to skip"),
    limit: int = Query(50, ge=1, le=100, description="Max items to return"),
    search: str | None = Query(default=None, description="Search by title"),
    user_id: UUID | None = Query(default=None, description="Filter by user ID"),
    include_archived: bool = Query(False, description="Include archived conversations"),
) -> Any:
    """List all conversations across all users (admin only)."""
    from sqlalchemy import func, select

    from app.db.models.conversation import Conversation, Message
    from app.db.models.user import User

    db = service.db
    query = (
        select(
            Conversation,
            func.count(Message.id).label("message_count"),
            User.email.label("user_email"),
        )
        .outerjoin(Message, Message.conversation_id == Conversation.id)
        .outerjoin(User, User.id == Conversation.user_id)
        .group_by(Conversation.id, User.email)
    )

    if search:
        query = query.where(Conversation.title.ilike(f"%{search}%"))
    if user_id:
        query = query.where(Conversation.user_id == user_id)
    if not include_archived:
        query = query.where(Conversation.is_archived.is_(False))

    # Count
    count_query = select(func.count()).select_from(Conversation)
    if search:
        count_query = count_query.where(Conversation.title.ilike(f"%{search}%"))
    if user_id:
        count_query = count_query.where(Conversation.user_id == user_id)
    if not include_archived:
        count_query = count_query.where(Conversation.is_archived.is_(False))
    total = await db.scalar(count_query) or 0

    query = query.order_by(Conversation.updated_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    rows = result.all()

    items = [
        AdminConversationRead(
            id=conv.id,
            user_id=conv.user_id,
            title=conv.title,
            is_archived=conv.is_archived,
            message_count=msg_count,
            user_email=email,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
        )
        for conv, msg_count, email in rows
    ]
    return AdminConversationList(items=items, total=total)


@router.get("/users", response_model=AdminUserList)
async def admin_list_users(
    service: ConversationSvc,
    current_user: CurrentAdmin,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: str | None = Query(default=None, description="Search by email or name"),
) -> Any:
    """List all users with conversation counts (admin only)."""
    from sqlalchemy import func, select

    from app.db.models.conversation import Conversation
    from app.db.models.user import User
    from app.schemas.conversation_share import AdminUserRead

    db = service.db
    query = (
        select(
            User,
            func.count(Conversation.id).label("conversation_count"),
        )
        .outerjoin(Conversation, Conversation.user_id == User.id)
        .group_by(User.id)
    )

    if search:
        query = query.where(User.email.ilike(f"%{search}%") | User.full_name.ilike(f"%{search}%"))

    count_query = select(func.count()).select_from(User)
    if search:
        count_query = count_query.where(
            User.email.ilike(f"%{search}%") | User.full_name.ilike(f"%{search}%")
        )
    total = await db.scalar(count_query) or 0

    query = query.order_by(User.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    rows = result.all()

    items = [
        AdminUserRead(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            is_active=user.is_active,
            conversation_count=conv_count,
            created_at=user.created_at,
        )
        for user, conv_count in rows
    ]
    return AdminUserList(items=items, total=total)


@router.get("/{conversation_id}", response_model=ConversationReadWithMessages)
async def admin_get_conversation(
    conversation_id: UUID,
    service: ConversationSvc,
    current_user: CurrentAdmin,
) -> Any:
    """Get any conversation with messages (admin read-only access)."""
    return await service.get_conversation_with_messages(conversation_id)
