"""Audio STT service — Whisper local or OpenAI Whisper API."""
from __future__ import annotations

import logging
import os
import tempfile

import httpx

logger = logging.getLogger(__name__)

STT_PROVIDER = os.getenv("STT_PROVIDER", "whisper")


async def transcribe(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    provider = STT_PROVIDER.lower()
    if provider == "openai":
        return await _openai_whisper(audio_bytes, filename)
    return await _local_whisper(audio_bytes, filename)


async def _local_whisper(audio_bytes: bytes, filename: str) -> str:
    try:
        import whisper  # type: ignore[import-untyped]

        model = whisper.load_model("base")
        suffix = "." + filename.rsplit(".", 1)[-1] if "." in filename else ".webm"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(audio_bytes)
            path = f.name
        result = model.transcribe(path)
        text: str = result.get("text", "").strip()
        return text
    except ImportError:
        logger.warning("openai-whisper not installed — returning placeholder")
        return "[Whisper not installed — run: pip install openai-whisper]"
    except Exception:
        logger.exception("Local Whisper transcription failed")
        return "[Transcription failed]"


async def _openai_whisper(audio_bytes: bytes, filename: str) -> str:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        return "[OpenAI API key not configured — set OPENAI_API_KEY]"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {api_key}"},
                files={"file": (filename, audio_bytes, "audio/webm")},
                data={"model": "whisper-1"},
            )
            r.raise_for_status()
            text: str = r.json().get("text", "").strip()
            return text
    except Exception:
        logger.exception("OpenAI Whisper transcription failed")
        return "[Transcription failed]"
