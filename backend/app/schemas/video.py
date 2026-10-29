from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class VideoGenerateRequest(BaseModel):
    prompt: str = Field(..., description="Text prompt describing the video to generate")
    duration_seconds: int = Field(default=4, ge=2, le=10)
    aspect_ratio: str = Field(default="16:9")
    conversation_id: Optional[str] = None


class VideoGenerateResponse(BaseModel):
    id: str
    status: str
    video_url: str
    thumbnail_url: Optional[str] = None
    duration_seconds: int
    resolution: str
    prompt: str
    provider: str


class VideoAnalyzeRequest(BaseModel):
    file_path: str
    query: Optional[str] = "Please summarize this video and describe key scenes with timestamps."


class VideoAnalyzeResponse(BaseModel):
    metadata: Dict[str, Any]
    keyframes_count: int
    thumbnail_url: Optional[str] = None
    response: str

