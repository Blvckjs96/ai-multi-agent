"""TDD tests for MessageFeedback — RED phase before implementation."""
import pytest
from app.db.models.feedback import MessageFeedback, FeedbackRating


def test_feedback_rating_enum_values():
    assert FeedbackRating.UP == "up"
    assert FeedbackRating.DOWN == "down"


def test_feedback_model_fields():
    assert hasattr(MessageFeedback, "conversation_id")
    assert hasattr(MessageFeedback, "message_id")
    assert hasattr(MessageFeedback, "user_id")
    assert hasattr(MessageFeedback, "rating")
    assert hasattr(MessageFeedback, "comment")


def test_feedback_repr():
    import uuid
    fb = MessageFeedback(
        id=uuid.uuid4(),
        conversation_id="c1",
        message_id="m1",
        user_id="u1",
        rating="up",
    )
    assert "up" in repr(fb)
