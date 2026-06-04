"""File storage service for chat file uploads and Chiron source files.

Supports two backends:
  LocalFileStorage  — filesystem (default for local dev)
  MinIOFileStorage  — S3-compatible object storage (production / when MINIO_ACCESS_KEY is set)

Files are keyed as: {user_or_workspace_id}/{uuid_prefix}_{filename}
"""

import asyncio
import logging
import uuid
from abc import ABC, abstractmethod
from pathlib import Path

logger = logging.getLogger(__name__)

ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "text/plain",
    "text/markdown",
    "text/csv",
    "text/html",
    "text/css",
    "text/xml",
    "text/x-python",
    "text/javascript",
    "text/x-yaml",
    "application/json",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/x-yaml",
}

IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}

TEXT_MIME_TYPES = {
    "text/plain",
    "text/markdown",
    "text/csv",
    "text/html",
    "text/css",
    "text/xml",
    "text/x-python",
    "text/javascript",
    "text/x-yaml",
    "application/json",
    "application/x-yaml",
}

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB


def classify_file(mime_type: str, filename: str) -> str:
    """Classify file type based on MIME type and extension."""
    if mime_type in IMAGE_MIME_TYPES:
        return "image"
    if mime_type == "application/pdf" or filename.lower().endswith(".pdf"):
        return "pdf"
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext == "docx" or "wordprocessingml" in mime_type:
        return "docx"
    return "text"


def make_storage_filename(filename: str) -> str:
    """Create a unique storage filename to prevent collisions."""
    return f"{uuid.uuid4().hex[:12]}_{filename}"


class BaseFileStorage(ABC):
    """Abstract file storage backend."""

    @abstractmethod
    async def save(self, user_id: str, filename: str, data: bytes) -> str:
        """Save file and return storage key."""

    @abstractmethod
    async def load(self, storage_key: str) -> bytes:
        """Load file bytes by storage key."""

    @abstractmethod
    async def delete(self, storage_key: str) -> None:
        """Delete file by storage key."""

    async def presign(self, storage_key: str, expires_seconds: int = 3600) -> str | None:
        """Return a time-limited download URL, or None if not supported."""
        return None

    def get_full_path(self, storage_path: str) -> Path | None:
        """Return absolute filesystem path if available (local storage only)."""
        return None


class LocalFileStorage(BaseFileStorage):
    """Store files on local filesystem."""

    def __init__(self, base_dir: str | Path = "media"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    async def save(self, user_id: str, filename: str, data: bytes) -> str:
        user_dir = self.base_dir / user_id
        user_dir.mkdir(parents=True, exist_ok=True)
        storage_name = make_storage_filename(filename)
        file_path = user_dir / storage_name
        file_path.write_bytes(data)
        return f"{user_id}/{storage_name}"

    async def load(self, storage_key: str) -> bytes:
        file_path = self.base_dir / storage_key
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {storage_key}")
        return file_path.read_bytes()

    async def delete(self, storage_key: str) -> None:
        file_path = self.base_dir / storage_key
        if file_path.exists():
            file_path.unlink()

    def get_full_path(self, storage_path: str) -> Path | None:
        file_path = self.base_dir / storage_path
        return file_path if file_path.exists() else None


class MinIOFileStorage(BaseFileStorage):
    """Store files in MinIO (S3-compatible object storage)."""

    def __init__(
        self,
        endpoint: str,
        access_key: str,
        secret_key: str,
        bucket: str,
        secure: bool = False,
    ) -> None:
        from minio import Minio

        self._client = Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure)
        self._bucket = bucket
        self._ensure_bucket()

    def _ensure_bucket(self) -> None:
        try:
            if not self._client.bucket_exists(self._bucket):
                self._client.make_bucket(self._bucket)
                logger.info("MinIO: created bucket %r", self._bucket)
        except Exception:
            logger.exception("MinIO: failed to ensure bucket %r exists", self._bucket)

    async def save(self, user_id: str, filename: str, data: bytes) -> str:
        import io

        key = f"{user_id}/{make_storage_filename(filename)}"
        await asyncio.to_thread(
            self._client.put_object,
            self._bucket,
            key,
            io.BytesIO(data),
            len(data),
        )
        return key

    async def load(self, storage_key: str) -> bytes:
        response = await asyncio.to_thread(self._client.get_object, self._bucket, storage_key)
        return response.read()

    async def delete(self, storage_key: str) -> None:
        await asyncio.to_thread(self._client.remove_object, self._bucket, storage_key)

    async def presign(self, storage_key: str, expires_seconds: int = 3600) -> str | None:
        from datetime import timedelta

        url = await asyncio.to_thread(
            self._client.presigned_get_object,
            self._bucket,
            storage_key,
            expires=timedelta(seconds=expires_seconds),
        )
        return url


# Module-level singleton so MinIO connection is reused across requests.
_storage: BaseFileStorage | None = None


def get_file_storage() -> BaseFileStorage:
    """Return the configured file storage backend (singleton)."""
    global _storage
    if _storage is not None:
        return _storage

    from app.core.config import settings

    if settings.MINIO_ACCESS_KEY and settings.MINIO_SECRET_KEY:
        logger.info("FileStorage: using MinIO endpoint=%r bucket=%r", settings.MINIO_ENDPOINT, settings.MINIO_BUCKET_CHIRON)
        _storage = MinIOFileStorage(
            endpoint=settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            bucket=settings.MINIO_BUCKET_CHIRON,
            secure=settings.MINIO_SECURE,
        )
    else:
        media_dir = getattr(settings, "MEDIA_DIR", "media")
        logger.info("FileStorage: using LocalFileStorage dir=%r", str(media_dir))
        _storage = LocalFileStorage(base_dir=media_dir)

    return _storage
