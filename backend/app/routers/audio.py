import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.core.config import settings
from app.core.security import validate_file_upload, MAX_FILE_SIZE_BYTES
from app.schemas.audio import TranscribeResponse, SynthesizeRequest, SynthesizeResponse
from app.services.audio_service import AudioService

router = APIRouter(prefix="/api/audio", tags=["Audio"])


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribes an uploaded audio file into text."""
    category, clean_filename = validate_file_upload(file)
    if category != "audio":
        raise HTTPException(status_code=400, detail="Only audio files (.mp3, .wav, .m4a, .webm, .ogg) are supported.")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    temp_path = os.path.join(settings.UPLOAD_DIR, f"audio_{uuid.uuid4()}_{clean_filename}")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Audio file exceeds maximum size limit.")

    with open(temp_path, "wb") as f:
        f.write(content)

    try:
        text = AudioService.transcribe(temp_path)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    return TranscribeResponse(text=text, language="en")


@router.post("/synthesize", response_model=SynthesizeResponse)
async def synthesize_speech(payload: SynthesizeRequest):
    """Synthesizes text into speech."""
    audio_url = AudioService.synthesize(text=payload.text, voice=payload.voice or "alloy")
    return SynthesizeResponse(
        audio_url=audio_url or "",
        format="mp3"
    )
