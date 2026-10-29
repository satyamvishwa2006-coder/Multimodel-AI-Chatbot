import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import validate_file_upload, MAX_FILE_SIZE_BYTES
from app.db.session import get_db
from app.db.models import VideoJob
from app.schemas.video import VideoGenerateRequest, VideoGenerateResponse, VideoAnalyzeRequest, VideoAnalyzeResponse
from app.services.video_service import VideoService
from app.utils.session_helper import get_session_id

router = APIRouter(prefix="/api/videos", tags=["Videos"])


@router.post("/generate", response_model=VideoGenerateResponse)
async def generate_video(
    payload: VideoGenerateRequest,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """
    Generates an AI video from text prompt with duration and aspect ratio options.
    Returns persistent video URL and metadata.
    """
    if not payload.prompt or not payload.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")

    result = VideoService.generate_video(
        prompt=payload.prompt,
        duration_seconds=payload.duration_seconds,
        aspect_ratio=payload.aspect_ratio,
    )

    job = VideoJob(
        session_id=session_id,
        conversation_id=payload.conversation_id,
        prompt=payload.prompt,
        status="completed",
        video_url=result["video_url"],
        thumbnail_url=result.get("thumbnail_url"),
        duration_seconds=result["duration_seconds"],
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    return VideoGenerateResponse(
        id=job.id,
        status="completed",
        video_url=result["video_url"],
        thumbnail_url=result.get("thumbnail_url"),
        duration_seconds=result["duration_seconds"],
        resolution=result["resolution"],
        prompt=result["prompt"],
        provider=result["provider"],
    )


@router.post("/understand", response_model=VideoAnalyzeResponse)
async def understand_uploaded_video(
    file: UploadFile = File(...),
    query: str = "Summarize this video and describe each scene with timestamps.",
):
    """
    Direct video understanding endpoint: extracts keyframes and runs vision model.
    """
    category, clean_filename = validate_file_upload(file)
    if category != "video":
        raise HTTPException(status_code=400, detail="Uploaded file is not a supported video format (.mp4, .webm, .mov).")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    temp_path = os.path.join(settings.UPLOAD_DIR, f"temp_vid_{uuid.uuid4()}_{clean_filename}")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES * 2:  # allow up to 30MB for video
        raise HTTPException(status_code=400, detail="Video file exceeds 30MB limit.")

    with open(temp_path, "wb") as f:
        f.write(content)

    try:
        analysis = VideoService.analyze_video(temp_path, user_query=query)
        return VideoAnalyzeResponse(**analysis)
    finally:
        pass

