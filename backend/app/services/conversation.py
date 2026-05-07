"""Conversation service (PostgreSQL async).

Contains business logic for conversation, message, and tool call operations.
"""

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.models.conversation import Conversation, Message, ToolCall
from app.db.models.message_rating import MessageRating
from app.db.models.user import User
from app.repositories import conversation_repo, conversation_share_repo
from app.schemas.conversation import (
    ConversationCreate,
    ConversationUpdate,
    ConversationWithLatestMessage,
    MessageCreate,
    MessageRead,
    ToolCallComplete,
    ToolCallCreate,
)

logger = logging.getLogger(__name__)

# Maximum number of conversations to export in a single request to prevent DoS.
MAX_EXPORT_LIMIT = 1000


class ConversationService:
    """Service for conversation-related business logic."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # Export Methods

    EXPORT_CHUNK_SIZE = 1000
    MESSAGE_EXPORT_LIMIT = 10000

    async def export_all(self) -> list[dict[str, Any]]:
        """Export all conversations with messages and ratings for admin download.

        Uses keyset pagination on (created_at, id) to avoid skipping or
        duplicating conversations when data changes during export.
        """
        import json

        from sqlalchemy import tuple_

        export_data: list[dict[str, Any]] = []
        last_created_at: datetime | None = None
        last_id: UUID | None = None

        while True:
            query = (
                select(Conversation)
                .order_by(Conversation.created_at.desc(), Conversation.id.desc())
                .limit(self.EXPORT_CHUNK_SIZE)
            )

            if last_created_at is not None and last_id is not None:
                query = query.where(
                    tuple_(Conversation.created_at, Conversation.id) < (last_created_at, last_id)
                )

            result = await self.db.execute(query)
            items = list(result.scalars().all())
            if not items:
                break

            # Collect all message IDs to fetch ratings in bulk
            all_message_ids: list[UUID] = []
            conv_messages_map: dict[str, list[Message | MessageRead]] = {}

            for conv in items:
                messages, _ = await self.list_messages(
                    conv.id, skip=0, limit=self.MESSAGE_EXPORT_LIMIT, include_tool_calls=True
                )
                conv_messages_map[str(conv.id)] = messages
                all_message_ids.extend([m.id for m in messages if m.id])
            # Fetch ratings for this chunk of messages
            message_ratings_map: dict[str, list[dict[str, Any]]] = {}
            if all_message_ids:
                ratings_query = (
                    select(MessageRating, User)
                    .join(User, MessageRating.user_id == User.id)
                    .where(MessageRating.message_id.in_(all_message_ids))
                )
                ratings_result = await self.db.execute(ratings_query)
                ratings = ratings_result.all()

                # Map message_id to list of ratings
                for rating, user in ratings:
                    msg_id = str(rating.message_id)
                    if msg_id not in message_ratings_map:
                        message_ratings_map[msg_id] = []
                    message_ratings_map[msg_id].append(
                        {
                            "id": str(rating.id),
                            "user_id": str(rating.user_id),
                            "user_email": getattr(user, "email", None),
                            "user_name": user.full_name if user else None,
                            "rating": rating.rating,
                            "comment": rating.comment,
                            "created_at": rating.created_at.isoformat()
                            if rating.created_at
                            else None,
                            "updated_at": rating.updated_at.isoformat()
                            if rating.updated_at
                            else None,
                        }
                    )

            # Build export data for this chunk
            for conv in items:
                messages = conv_messages_map.get(str(conv.id), [])
                export_data.append(
                    {
                        "id": str(conv.id),
                        "user_id": str(conv.user_id) if conv.user_id else None,
                        "title": conv.title,
                        "created_at": conv.created_at.isoformat() if conv.created_at else None,
                        "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
                        "is_archived": conv.is_archived,
                        "messages": [
                            {
                                "id": str(m.id),
                                "role": m.role,
                                "content": m.content,
                                "created_at": m.created_at.isoformat() if m.created_at else None,
                                "model_name": m.model_name,
                                "tokens_used": m.tokens_used,
                                "tool_calls": [
                                    {
                                        "tool_name": tc.tool_name,
                                        "args": tc.args
                                        if isinstance(tc.args, dict)
                                        else json.loads(tc.args)
                                        if isinstance(tc.args, str) and tc.args.strip()
                                        else {},
                                        "result": tc.result,
                                        "status": tc.status,
                                    }
                                    for tc in (m.tool_calls or [])
                                ]
                                if hasattr(m, "tool_calls") and m.tool_calls
                                else [],
                                "ratings": message_ratings_map.get(str(m.id), []),
                            }
                            for m in messages
                        ],
                    }
                )

            # Advance cursor for keyset pagination
            last_created_at = items[-1].created_at
            last_id = items[-1].id

            if len(items) < self.EXPORT_CHUNK_SIZE:
                break

        return export_data

    # Conversation Methods

    async def get_conversation(
        self,
        conversation_id: UUID,
        *,
        include_messages: bool = False,
        user_id: UUID | None = None,
    ) -> Conversation:
        """Get conversation by ID.

        Raises:
            NotFoundError: If conversation does not exist or user has no access.
        """
        conversation = await conversation_repo.get_conversation_by_id(
            self.db, conversation_id, include_messages=include_messages
        )
        if not conversation:
            raise NotFoundError(
                message="Conversation not found",
                details={"conversation_id": str(conversation_id)},
            )
        if (
            user_id is not None
            and hasattr(conversation, "user_id")
            and conversation.user_id is not None
            and str(conversation.user_id) != str(user_id)
        ):
            # Not the owner — check if user has a share granting access
            share = await conversation_share_repo.get_share(self.db, conversation_id, user_id)
            if not share:
                raise NotFoundError(
                    message="Conversation not found",
                    details={"conversation_id": str(conversation_id)},
                )
        return conversation

    async def list_conversations(
        self,
        user_id: UUID | None = None,
        *,
        skip: int = 0,
        limit: int = 50,
        include_archived: bool = False,
    ) -> tuple[list[Conversation], int]:
        """List conversations with pagination.

        Returns:
            Tuple of (conversations, total_count).
        """
        items = await conversation_repo.get_conversations_by_user(
            self.db,
            user_id=user_id,
            skip=skip,
            limit=limit,
            include_archived=include_archived,
        )
        total = await conversation_repo.count_conversations(
            self.db,
            user_id=user_id,
            include_archived=include_archived,
        )
        return items, total

    async def list_conversations_admin(
        self,
        *,
        skip: int = 0,
        limit: int = 50,
        include_archived: bool = False,
        search: str | None = None,
    ) -> tuple[list[ConversationWithLatestMessage], int]:
        """List all conversations for admin with message counts.

        Returns conversations with message_count but no message content.
        """
        from app.schemas.conversation import ConversationRead

        rows, total = await conversation_repo.get_all_conversations_with_count(
            self.db,
            skip=skip,
            limit=limit,
            include_archived=include_archived,
            search=search,
        )

        items = []
        for conv, msg_count in rows:
            conv_dict = {
                **ConversationRead.model_validate(conv).model_dump(),
                "message_count": msg_count,
            }
            items.append(ConversationWithLatestMessage.model_validate(conv_dict))

        return items, total

    async def create_conversation(
        self,
        data: ConversationCreate,
    ) -> Conversation:
        """Create a new conversation."""
        return await conversation_repo.create_conversation(
            self.db,
            user_id=data.user_id,
            title=data.title,
        )

    async def update_conversation(
        self,
        conversation_id: UUID,
        data: ConversationUpdate,
        user_id: UUID | None = None,
    ) -> Conversation:
        """Update a conversation.

        Raises:
            NotFoundError: If conversation does not exist.
        """
        conversation = await self.get_conversation(
            conversation_id,
            user_id=user_id,
        )
        update_data = data.model_dump(exclude_unset=True)
        return await conversation_repo.update_conversation(
            self.db, db_conversation=conversation, update_data=update_data
        )

    async def archive_conversation(
        self,
        conversation_id: UUID,
        user_id: UUID | None = None,
    ) -> Conversation:
        """Archive a conversation.

        Raises:
            NotFoundError: If conversation does not exist or user has no access.
        """
        # Verify ownership first
        await self.get_conversation(
            conversation_id,
            user_id=user_id,
        )
        conversation = await conversation_repo.archive_conversation(self.db, conversation_id)
        if not conversation:
            raise NotFoundError(
                message="Conversation not found",
                details={"conversation_id": str(conversation_id)},
            )
        return conversation

    async def delete_conversation(
        self,
        conversation_id: UUID,
        user_id: UUID | None = None,
    ) -> bool:
        """Delete a conversation.

        Raises:
            NotFoundError: If conversation does not exist or user has no access.
        """
        # Verify ownership first
        await self.get_conversation(
            conversation_id,
            user_id=user_id,
        )
        deleted = await conversation_repo.delete_conversation(self.db, conversation_id)
        if not deleted:
            raise NotFoundError(
                message="Conversation not found",
                details={"conversation_id": str(conversation_id)},
            )
        return True

    # Message Methods

    async def get_message(self, message_id: UUID) -> Message:
        """Get message by ID.

        Raises:
            NotFoundError: If message does not exist.
        """
        message = await conversation_repo.get_message_by_id(self.db, message_id)
        if not message:
            raise NotFoundError(
                message="Message not found",
                details={"message_id": str(message_id)},
            )
        return message

    async def list_messages(
        self,
        conversation_id: UUID,
        *,
        skip: int = 0,
        limit: int = 100,
        include_tool_calls: bool = False,
        user_id: UUID | None = None,
    ) -> tuple[list[Message | MessageRead], int]:
        """List messages in a conversation.

        Returns:
            Tuple of (messages, total_count).

        When user_id is provided, messages will be enriched with:
        - user_rating: The user's rating for the message (1, -1, or None)
        - rating_count: Aggregate counts {likes: N, dislikes: N}
        """
        # Verify conversation exists
        await self.get_conversation(conversation_id)
        items = await conversation_repo.get_messages_by_conversation(
            self.db,
            conversation_id,
            skip=skip,
            limit=limit,
            include_tool_calls=include_tool_calls,
        )
        total = await conversation_repo.count_messages(self.db, conversation_id)

        # Enrich messages with rating data if user_id is provided
        if user_id is not None and items:
            message_ids = [msg.id for msg in items]

            # Fetch user ratings for these messages
            user_ratings_query = select(MessageRating).where(
                MessageRating.message_id.in_(message_ids),
                MessageRating.user_id == user_id,
            )
            user_ratings_result = await self.db.execute(user_ratings_query)
            user_ratings = {
                rating.message_id: rating.rating for rating in user_ratings_result.scalars().all()
            }

            # Fetch aggregate rating counts for these messages
            rating_counts_query = (
                select(
                    MessageRating.message_id,
                    func.sum(case((MessageRating.rating == 1, 1), else_=0)).label("likes"),
                    func.sum(case((MessageRating.rating == -1, 1), else_=0)).label("dislikes"),
                )
                .where(MessageRating.message_id.in_(message_ids))
                .group_by(MessageRating.message_id)
            )

            rating_counts_result = await self.db.execute(rating_counts_query)
            rating_counts = {
                row.message_id: {"likes": row.likes or 0, "dislikes": row.dislikes or 0}
                for row in rating_counts_result.all()
            }

            # Construct enriched schema objects with rating data
            enriched: list[Message | MessageRead] = []
            for msg in items:
                msg_schema = MessageRead.model_validate(msg)
                msg_schema.user_rating = user_ratings.get(msg.id)
                msg_schema.rating_count = rating_counts.get(msg.id)
                enriched.append(msg_schema)
            return enriched, total
        return list(items), total

    async def add_message(
        self,
        conversation_id: UUID,
        data: MessageCreate,
    ) -> Message:
        """Add a message to a conversation.

        Raises:
            NotFoundError: If conversation does not exist.
        """
        # Verify conversation exists
        await self.get_conversation(conversation_id)
        return await conversation_repo.create_message(
            self.db,
            conversation_id=conversation_id,
            role=data.role,
            content=data.content,
            model_name=data.model_name,
            tokens_used=data.tokens_used,
        )

    async def delete_message(self, message_id: UUID) -> bool:
        """Delete a message.

        Raises:
            NotFoundError: If message does not exist.
        """
        deleted = await conversation_repo.delete_message(self.db, message_id)
        if not deleted:
            raise NotFoundError(
                message="Message not found",
                details={"message_id": str(message_id)},
            )
        return True

    # Tool Call Methods

    async def get_tool_call(self, tool_call_id: UUID) -> ToolCall:
        """Get tool call by ID.

        Raises:
            NotFoundError: If tool call does not exist.
        """
        tool_call = await conversation_repo.get_tool_call_by_id(self.db, tool_call_id)
        if not tool_call:
            raise NotFoundError(
                message="Tool call not found",
                details={"tool_call_id": str(tool_call_id)},
            )
        return tool_call

    async def list_tool_calls(self, message_id: UUID) -> list[ToolCall]:
        """List tool calls for a message."""
        # Verify message exists
        await self.get_message(message_id)
        return await conversation_repo.get_tool_calls_by_message(self.db, message_id)

    async def start_tool_call(
        self,
        message_id: UUID,
        data: ToolCallCreate,
    ) -> ToolCall:
        """Record the start of a tool call.

        Raises:
            NotFoundError: If message does not exist.
        """
        # Verify message exists
        await self.get_message(message_id)
        return await conversation_repo.create_tool_call(
            self.db,
            message_id=message_id,
            tool_call_id=data.tool_call_id,
            tool_name=data.tool_name,
            args=data.args,
            started_at=data.started_at or datetime.now(UTC),
        )

    async def complete_tool_call(
        self,
        tool_call_id: UUID,
        data: ToolCallComplete,
    ) -> ToolCall:
        """Mark a tool call as completed.

        Raises:
            NotFoundError: If tool call does not exist.
        """
        tool_call = await self.get_tool_call(tool_call_id)
        return await conversation_repo.complete_tool_call(
            self.db,
            db_tool_call=tool_call,
            result=data.result,
            completed_at=data.completed_at or datetime.now(UTC),
            success=data.success,
        )

    async def link_files_to_message(self, message_id: UUID, file_ids: list[str]) -> None:
        """Link uploaded chat files to a message."""
        if not file_ids:
            return
        from sqlalchemy import update as sa_update

        from app.db.models.chat_file import ChatFile

        file_uuids = [UUID(fid) for fid in file_ids]
        await self.db.execute(
            sa_update(ChatFile).where(ChatFile.id.in_(file_uuids)).values(message_id=message_id)
        )
        await self.db.flush()
