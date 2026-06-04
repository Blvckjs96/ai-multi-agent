"""Audio API — Speech-to-Text transcription."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, File, UploadFile

from app.api.deps import CurrentUser
from app.services.audio import transcribe

router = APIRouter(prefix="/audio", tags=["audio"])


@router.post("/transcribe")
async def transcribe_audio(
    user: CurrentUser,
    file: UploadFile = File(...),
) -> Any:
    audio_bytes = await file.read()
    text = await transcribe(audio_bytes, file.filename or "audio.webm")
    return {"text": text}
