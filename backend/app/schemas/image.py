from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


class ImageGenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=2, max_length=2000, description="Detailed text prompt describing the image to generate")
    width: Optional[int] = Field(default=768, ge=256, le=1440)
    height: Optional[int] = Field(default=768, ge=256, le=1440)


class ImageGenerateResponse(BaseModel):
    image_url: str
    prompt: str
    provider: str
    filename: str
    file_size: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

