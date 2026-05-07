"""Message rating service - business logic for ratings."""

from collections.abc import AsyncGenerator
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.db.models.conversation import Message
from app.repositories import conversation as conversation_repo
from app.repositories import message_rating as rating_repo
from app.schemas.message_rating import (
    MessageRatingCreate,
    MessageRatingRead,
    MessageRatingWithDetails,
    RatingSummary,
    RatingValue,
)


class MessageRatingService:
    """Service for managing message ratings."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _get_message_role(self, message_id: UUID) -> str:
        """Get the role of a message.

        Raises:
            NotFoundError: If message doesn't exist
        """
        query = select(Message.role).where(Message.id == message_id)
        result = await self.db.execute(query)
        role = result.scalar_one_or_none()
        if not role:
            raise NotFoundError(
                message="Message not found", details={"message_id": str(message_id)}
            )
        return role

    async def _validate_message_in_conversation(
        self, message_id: UUID, conversation_id: UUID
    ) -> None:
        """Validate that a message belongs to the specified conversation.

        Raises:
            NotFoundError: If message doesn't exist or belongs to a different conversation
        """
        query = select(Message.conversation_id).where(Message.id == message_id)
        result = await self.db.execute(query)
        message_conv_id = result.scalar_one_or_none()
        if not message_conv_id:
            raise NotFoundError(
                message="Message not found", details={"message_id": str(message_id)}
            )
        if message_conv_id != conversation_id:
            raise NotFoundError(
                message="Message not found in this conversation",
                details={"message_id": str(message_id), "conversation_id": str(conversation_id)},
            )

    async def _validate_conversation_ownership(self, conversation_id: UUID, user_id: UUID) -> None:
        """Validate that the conversation belongs to the specified user.

        Raises:
            NotFoundError: If conversation doesn't exist or belongs to a different user
        """
        conv = await conversation_repo.get_conversation_by_id(self.db, conversation_id)
        if not conv or conv.user_id != user_id:
            raise NotFoundError(
                message="Conversation not found",
                details={"conversation_id": str(conversation_id)},
            )

    async def rate_message(
        self,
        conversation_id: UUID,
        message_id: UUID,
        user_id: UUID,
        data: MessageRatingCreate,
    ) -> tuple[MessageRatingRead, bool]:
        """Rate or update rating for a message.

        Args:
            conversation_id: The conversation containing the message
            message_id: The message to rate
            user_id: The user rating the message
            data: Rating data (rating value, optional comment)

        Returns:
            Tuple of (rating, is_new) where is_new is True if created, False if updated

        Raises:
            ValidationError: If trying to rate a non-assistant message
            NotFoundError: If message doesn't exist or not in the specified conversation
        """
        # Validate message belongs to the specified conversation
        await self._validate_conversation_ownership(conversation_id, user_id)
        await self._validate_message_in_conversation(message_id, conversation_id)

        message_role = await self._get_message_role(message_id)
        if message_role != "assistant":
            raise ValidationError(
                message="Only assistant messages can be rated",
                details={"message_role": message_role},
            )

        # Check for existing rating
        existing = await rating_repo.get_rating_by_message_and_user(self.db, message_id, user_id)

        if existing:
            # Update existing rating
            updated = await rating_repo.update_rating(
                self.db, existing, new_rating=data.rating, comment=data.comment
            )
            return MessageRatingRead.model_validate(updated), False

        # Create new rating with race condition handling
        try:
            rating = await rating_repo.create_rating(
                self.db,
                message_id=message_id,
                user_id=user_id,
                rating=data.rating,
                comment=data.comment,
            )
            return MessageRatingRead.model_validate(rating), True
        except IntegrityError:
            # Race condition: another request created the rating first
            await self.db.rollback()
            existing = await rating_repo.get_rating_by_message_and_user(
                self.db, message_id, user_id
            )
            if existing:
                # Update the existing rating
                updated = await rating_repo.update_rating(
                    self.db, existing, new_rating=data.rating, comment=data.comment
                )
                return MessageRatingRead.model_validate(updated), False
            raise

    async def remove_rating(
        self,
        conversation_id: UUID,
        message_id: UUID,
        user_id: UUID,
    ) -> None:
        """Remove a user's rating from a message.

        Args:
            conversation_id: The conversation containing the message
            message_id: The message to remove rating from
            user_id: The user who owns the rating

        Raises:
            NotFoundError: If message doesn't exist, not in conversation, or no rating exists
        """
        # Validate message belongs to the specified conversation
        await self._validate_conversation_ownership(conversation_id, user_id)
        await self._validate_message_in_conversation(message_id, conversation_id)

        rating = await rating_repo.get_rating_by_message_and_user(self.db, message_id, user_id)
        if not rating:
            raise NotFoundError(
                message="Rating not found",
                details={"message_id": str(message_id), "user_id": str(user_id)},
            )
        await rating_repo.delete_rating(self.db, rating)

    async def get_message_ratings(
        self,
        message_id: UUID,
    ) -> dict[str, int]:
        """Get aggregate rating counts for a message.

        Returns:
            Dict with likes and dislikes count
        """
        ratings = await rating_repo.get_ratings_for_message(self.db, message_id)
        return {
            "likes": sum(1 for r in ratings if r.rating == 1),
            "dislikes": sum(1 for r in ratings if r.rating == -1),
        }

    async def list_ratings(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        rating_filter: int | None = None,
        with_comments_only: bool = False,
    ) -> tuple[list[MessageRatingWithDetails], int]:
        """List all ratings (admin only)."""
        items, total = await rating_repo.list_ratings(
            self.db,
            skip=skip,
            limit=limit,
            rating_filter=rating_filter,
            with_comments_only=with_comments_only,
        )

        # Enrich with related data
        result = []
        for item in items:
            result.append(
                MessageRatingWithDetails(
                    id=item.id,
                    message_id=item.message_id,
                    user_id=item.user_id,
                    rating=RatingValue(item.rating),
                    comment=item.comment,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                    message_content=(item.message.content or "")[:200] if item.message else None,
                    message_role=item.message.role if item.message else None,
                    conversation_id=item.message.conversation_id if item.message else None,
                    user_email=item.user.email if item.user else None,
                    user_name=item.user.full_name if item.user else None,
                )
            )

        return result, total

    EXPORT_CHUNK_SIZE = 5000

    async def export_all_ratings(
        self,
        *,
        rating_filter: int | None = None,
        with_comments_only: bool = False,
    ) -> AsyncGenerator[list[MessageRatingWithDetails], None]:
        """Yield all ratings in chunks for memory-efficient export.

        Fetches ratings in pages to avoid loading all ORM objects into
        memory at once. Each yielded chunk is a list of lightweight
        Pydantic schemas.
        """
        skip = 0
        while True:
            items, total = await rating_repo.list_ratings(
                self.db,
                skip=skip,
                limit=self.EXPORT_CHUNK_SIZE,
                rating_filter=rating_filter,
                with_comments_only=with_comments_only,
            )
            if not items:
                break
            result = [
                MessageRatingWithDetails(
                    id=item.id,
                    message_id=item.message_id,
                    user_id=item.user_id,
                    rating=RatingValue(item.rating),
                    comment=item.comment,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                    message_content=(item.message.content or "")[:200] if item.message else None,
                    message_role=item.message.role if item.message else None,
                    conversation_id=item.message.conversation_id if item.message else None,
                    user_email=item.user.email if item.user else None,
                    user_name=item.user.full_name if item.user else None,
                )
                for item in items
            ]
            yield result
            skip += self.EXPORT_CHUNK_SIZE
            if skip >= total:
                break

    async def get_summary(self, *, days: int = 30) -> RatingSummary:
        """Get aggregated rating statistics."""
        summary_data = await rating_repo.get_rating_summary(self.db, days=days)
        return RatingSummary(**summary_data)
