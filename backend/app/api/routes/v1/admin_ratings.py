"""Admin endpoints for message ratings.

Provides endpoints for administrators to view and analyze user ratings
on AI assistant messages.

The endpoints are:
- GET /admin/ratings - List all ratings with filtering
- GET /admin/ratings/summary - Get aggregated rating statistics
- GET /admin/ratings/export - Export ratings as JSON or CSV
"""

import csv
from collections.abc import AsyncIterable, AsyncIterator, Iterable, Iterator
from datetime import UTC, datetime
from io import StringIO
from typing import Any

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse, StreamingResponse

from app.api.deps import CurrentAdmin, MessageRatingSvc
from app.core.exceptions import ValidationError
from app.schemas.message_rating import (
    MessageRatingList,
    MessageRatingWithDetails,
    RatingSummary,
)

router = APIRouter()

_CSV_INJECTION_PREFIXES = ("=", "+", "-", "@", "\t", "\r")
_CSV_HEADER = [
    "ID",
    "Message ID",
    "Conversation ID",
    "User ID",
    "Rating",
    "Comment",
    "Message Content",
    "Message Role",
    "User Email",
    "User Name",
    "Created At",
    "Updated At",
]


def _csv_escape(value: str) -> str:
    """Neutralize CSV formula injection by prefixing risky cells with a single quote.

    Excel/Sheets treat cells starting with =, +, -, @, tab or CR as formulas.
    """
    if value and value[0] in _CSV_INJECTION_PREFIXES:
        return "'" + value
    return value


def _csv_row_values(item: MessageRatingWithDetails) -> list[str]:
    return [
        _csv_escape(str(item.id)),
        _csv_escape(str(item.message_id)),
        _csv_escape(str(item.conversation_id)) if item.conversation_id else "",
        _csv_escape(str(item.user_id)),
        "Like" if item.rating == 1 else "Dislike",
        _csv_escape(item.comment or ""),
        _csv_escape(item.message_content or ""),
        _csv_escape(item.message_role or ""),
        _csv_escape(item.user_email or ""),
        _csv_escape(item.user_name or ""),
        item.created_at.isoformat() if item.created_at else "",
        item.updated_at.isoformat() if item.updated_at else "",
    ]


def _serialize_csv_row(values: list[str]) -> str:
    buffer = StringIO()
    csv.writer(buffer).writerow(values)
    return buffer.getvalue()


def _validate_export_format(export_format: str) -> str:
    fmt = export_format.lower()
    if fmt not in ("json", "csv"):
        raise ValidationError(
            message="Invalid export format. Must be 'json' or 'csv'.",
            details={"export_format": export_format},
        )
    return fmt


def _export_disposition(now: datetime, fmt: str) -> str:
    return f'attachment; filename="ratings_export_{now.strftime("%Y%m%d_%H%M%S")}.{fmt}"'


def _json_export_response(items: list[MessageRatingWithDetails], now: datetime) -> JSONResponse:
    return JSONResponse(
        content={
            "ratings": [item.model_dump(mode="json") for item in items],
            "total": len(items),
            "exported_at": now.isoformat(),
        },
        headers={"Content-Disposition": _export_disposition(now, "json")},
    )


def _stream_csv_sync(
    chunks: Iterable[list[MessageRatingWithDetails]], now: datetime
) -> StreamingResponse:
    """Stream CSV row-by-row from a sync chunk iterable."""

    def generate() -> Iterator[str]:
        yield _serialize_csv_row(_CSV_HEADER)
        for chunk in chunks:
            for item in chunk:
                yield _serialize_csv_row(_csv_row_values(item))

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": _export_disposition(now, "csv")},
    )


def _stream_csv_async(
    chunks: AsyncIterable[list[MessageRatingWithDetails]], now: datetime
) -> StreamingResponse:
    """Stream CSV row-by-row from an async chunk iterable."""

    async def generate() -> AsyncIterator[str]:
        yield _serialize_csv_row(_CSV_HEADER)
        async for chunk in chunks:
            for item in chunk:
                yield _serialize_csv_row(_csv_row_values(item))

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": _export_disposition(now, "csv")},
    )


@router.get("", response_model=MessageRatingList)
async def list_ratings_admin(
    rating_service: MessageRatingSvc,
    admin_user: CurrentAdmin,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    rating_filter: int | None = Query(None, ge=-1, le=1, description="Filter by rating value"),
    with_comments_only: bool = Query(False, description="Only show ratings with comments"),
) -> Any:
    """List all ratings with filtering (admin only).

    Returns paginated list of ratings with optional filters:
    - rating_filter: Filter by rating value (1 for likes, -1 for dislikes)
    - with_comments_only: Only return ratings that have comments

    Results are ordered by creation date (newest first).
    """
    items, total = await rating_service.list_ratings(
        skip=skip,
        limit=limit,
        rating_filter=rating_filter,
        with_comments_only=with_comments_only,
    )
    return MessageRatingList(items=items, total=total)


@router.get("/summary", response_model=RatingSummary)
async def get_rating_summary(
    rating_service: MessageRatingSvc,
    admin_user: CurrentAdmin,
    days: int = Query(30, ge=1, le=365, description="Number of days to include"),
) -> Any:
    """Get aggregated rating statistics (admin only).

    Returns summary statistics including:
    - Total ratings count
    - Like/dislike counts
    - Average rating (-1.0 to 1.0)
    - Count of ratings with comments
    - Daily breakdown of ratings

    The `days` parameter controls the time window (default: 30 days).
    """
    return await rating_service.get_summary(days=days)


@router.get("/export")
async def export_ratings(
    rating_service: MessageRatingSvc,
    admin_user: CurrentAdmin,
    export_format: str = Query("json", description="Export format: 'json' or 'csv'"),
    rating_filter: int | None = Query(None, ge=-1, le=1, description="Filter by rating value"),
    with_comments_only: bool = Query(False, description="Only show ratings with comments"),
) -> Any:
    """Export all ratings as JSON or CSV (admin only).

    CSV is streamed row-by-row; JSON collects into a single document.
    """
    fmt = _validate_export_format(export_format)
    now = datetime.now(UTC)
    chunks = rating_service.export_all_ratings(
        rating_filter=rating_filter,
        with_comments_only=with_comments_only,
    )
    if fmt == "csv":
        return _stream_csv_async(chunks, now)
    all_items: list[MessageRatingWithDetails] = []
    async for chunk in chunks:
        all_items.extend(chunk)
    return _json_export_response(all_items, now)
