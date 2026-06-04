"""TDD tests for Note model."""
from app.db.models.note import Note


def test_note_has_required_fields():
    assert hasattr(Note, 'title')
    assert hasattr(Note, 'content')
    assert hasattr(Note, 'user_id')
    assert hasattr(Note, 'pinned')
    assert hasattr(Note, 'workspace_id')


def test_note_repr():
    import uuid
    n = Note(id=uuid.uuid4(), user_id="u1", title="Test Note")
    assert "Test Note" in repr(n)
