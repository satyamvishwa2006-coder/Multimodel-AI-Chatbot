from typing import Optional
from pydantic import BaseModel, Field


class TranscribeResponse(BaseModel):
    text: str
    language: Optional[str] = "en"
    duration: Optional[float] = None


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    voice: Optional[str] = "alloy"


class SynthesizeResponse(BaseModel):
    audio_url: str
    format: str = "mp3"
