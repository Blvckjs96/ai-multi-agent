"""Chiron knowledge engine endpoints.

GET    /chiron/{workspace_id}/pages                       list wiki pages
GET    /chiron/{workspace_id}/pages/{id}                  get a page
DELETE /chiron/{workspace_id}/pages/{id}                  delete a page
POST   /chiron/{workspace_id}/ingest                      ingest source (JSON body)
POST   /chiron/{workspace_id}/upload                      ingest source (file upload → MinIO)
GET    /chiron/{workspace_id}/sources/{source_id}/download presigned download URL
POST   /chiron/{workspace_id}/search                      semantic search (vector → TF-IDF fallback)
GET    /chiron/{workspace_id}/sources                     list ingested sources
GET    /chiron/{workspace_id}/plans                       list compilation plans
GET    /chiron/{workspace_id}/plans/{plan_id}             get plan detail
POST   /chiron/{workspace_id}/plans/{plan_id}/approve     approve → COMMIT
POST   /chiron/{workspace_id}/plans/{plan_id}/reject      reject plan
"""

import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel

from app.api.deps import CurrentUser, DBSession, ValidAPIKey
from app.services.chiron import ChironService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chiron", tags=["chiron"])


class IngestRequest(BaseModel):
    file_path: str
    content: str
    mime_type: str = "text/plain"


class SearchRequest(BaseModel):
    query: str
    top_k: int = 5


class RejectRequest(BaseModel):
    reason: str = ""


class PageRead(BaseModel):
    id: UUID
    workspace_id: UUID
    title: str
    summary: str | None = None
    revision: int
    tags: list | None = None

    model_config = {"from_attributes": True}


class PageDetail(PageRead):
    content: str


class SourceRead(BaseModel):
    id: UUID
    workspace_id: UUID
    file_path: str
    status: str
    mime_type: str
    minio_key: str | None = None

    model_config = {"from_attributes": True}


class PlanRead(BaseModel):
    id: UUID
    source_id: UUID
    workspace_id: UUID
    phase: str
    status: str
    phase_results: dict | None = None
    error_message: str | None = None
    arq_job_id: str | None = None

    model_config = {"from_attributes": True}


class PlanDetail(PlanRead):
    proposed_pages: list | None = None


class PlanList(BaseModel):
    items: list[PlanRead]
    total: int


# ── Pages ────────────────────────────────────────────────────────────────────


@router.get("/{workspace_id}/pages", response_model=list[PageRead])
async def list_pages(workspace_id: UUID, db: DBSession, api_key: ValidAPIKey) -> Any:
    return await ChironService(db).list_pages(workspace_id)


@router.get("/{workspace_id}/pages/{page_id}", response_model=PageDetail)
async def get_page(workspace_id: UUID, page_id: UUID, db: DBSession, api_key: ValidAPIKey) -> Any:
    return await ChironService(db).get_page(page_id)


@router.delete(
    "/{workspace_id}/pages/{page_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None
)
async def delete_page(
    workspace_id: UUID, page_id: UUID, db: DBSession, api_key: ValidAPIKey
) -> None:
    await ChironService(db).delete_page(page_id)


# ── Sources ───────────────────────────────────────────────────────────────────


@router.post(
    "/{workspace_id}/ingest", response_model=SourceRead, status_code=status.HTTP_201_CREATED
)
async def ingest_source(
    workspace_id: UUID, body: IngestRequest, db: DBSession, api_key: ValidAPIKey
) -> Any:
    return await ChironService(db).ingest_source(
        workspace_id, body.file_path, body.content, body.mime_type
    )


_CHIRON_TEXT_TYPES = {
    "text/plain",
    "text/markdown",
    "text/csv",
    "text/html",
    "text/x-python",
    "text/javascript",
    "text/x-yaml",
    "application/json",
    "application/x-yaml",
}

_CHIRON_MAX_UPLOAD = 50 * 1024 * 1024  # 50 MB


@router.post(
    "/{workspace_id}/upload",
    response_model=SourceRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_source(
    workspace_id: UUID,
    db: DBSession,
    api_key: ValidAPIKey,
    file: UploadFile = File(...),
) -> Any:
    """Upload a text file, store it in MinIO (or local), and enqueue the MRP pipeline."""
    from app.services.file_storage import get_file_storage

    data = await file.read()
    if len(data) > _CHIRON_MAX_UPLOAD:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {_CHIRON_MAX_UPLOAD // 1024 // 1024} MB limit",
        )

    mime_type = file.content_type or "text/plain"
    filename = file.filename or "upload.txt"

    if mime_type not in _CHIRON_TEXT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported MIME type {mime_type!r}. Accepted: {sorted(_CHIRON_TEXT_TYPES)}",
        )

    content = data.decode("utf-8", errors="replace")

    storage = get_file_storage()
    storage_key = await storage.save(str(workspace_id), filename, data)
    logger.info("chiron upload: stored %r → key=%r", filename, storage_key)

    return await ChironService(db).ingest_source(
        workspace_id, filename, content, mime_type, storage_key=storage_key
    )


@router.get("/{workspace_id}/sources/{source_id}/download")
async def download_source(
    workspace_id: UUID,
    source_id: UUID,
    db: DBSession,
    api_key: ValidAPIKey,
) -> Any:
    """Return a presigned download URL (MinIO) or 404 if no file is stored."""
    from app.services.file_storage import get_file_storage

    from sqlalchemy import select

    from app.db.models.chiron import ChironSource

    result = await db.execute(
        select(ChironSource).where(
            ChironSource.id == source_id,
            ChironSource.workspace_id == workspace_id,
        )
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")
    if not source.minio_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No file stored for this source (was ingested via JSON)",
        )

    storage = get_file_storage()
    url = await storage.presign(source.minio_key)
    if url is None:
        # Local storage: return a hint rather than a real URL
        return {"storage_key": source.minio_key, "presigned_url": None, "note": "local storage"}

    return {"storage_key": source.minio_key, "presigned_url": url}


@router.post("/{workspace_id}/search")
async def search(
    workspace_id: UUID, body: SearchRequest, db: DBSession, api_key: ValidAPIKey
) -> Any:
    results = await ChironService(db).search(workspace_id, body.query, top_k=body.top_k)
    return {"results": results, "query": body.query}


@router.post("/{workspace_id}/hybrid-search")
async def hybrid_search(
    workspace_id: UUID, body: SearchRequest, db: DBSession, api_key: ValidAPIKey
) -> Any:
    results = await ChironService(db).hybrid_search(workspace_id, body.query, top_k=body.top_k or 8)
    return {"items": results, "total": len(results)}


@router.get("/{workspace_id}/sources", response_model=list[SourceRead])
async def list_sources(workspace_id: UUID, db: DBSession, api_key: ValidAPIKey) -> Any:
    return await ChironService(db).list_sources(workspace_id)


# ── Compilation Plans ─────────────────────────────────────────────────────────


@router.get("/{workspace_id}/plans", response_model=PlanList)
async def list_plans(
    workspace_id: UUID,
    db: DBSession,
    api_key: ValidAPIKey,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> Any:
    items, total = await ChironService(db).list_plans(workspace_id, skip=skip, limit=limit)
    return PlanList(items=items, total=total)


@router.get("/{workspace_id}/plans/{plan_id}", response_model=PlanDetail)
async def get_plan(workspace_id: UUID, plan_id: UUID, db: DBSession, api_key: ValidAPIKey) -> Any:
    return await ChironService(db).get_plan(plan_id)


@router.post("/{workspace_id}/plans/{plan_id}/approve")
async def approve_plan(
    workspace_id: UUID,
    plan_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
) -> Any:
    svc = ChironService(db)
    return await svc.approve_plan(plan_id, workspace_id, changed_by=current_user.email)


@router.post("/{workspace_id}/plans/{plan_id}/reject")
async def reject_plan(
    workspace_id: UUID,
    plan_id: UUID,
    body: RejectRequest,
    db: DBSession,
    current_user: CurrentUser,
) -> Any:
    svc = ChironService(db)
    return await svc.reject_plan(plan_id, workspace_id, reason=body.reason)
