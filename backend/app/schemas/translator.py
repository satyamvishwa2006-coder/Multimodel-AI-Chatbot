from typing import Optional
from pydantic import BaseModel, Field


class TranslateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000, description="Text to translate")
    source_lang: Optional[str] = Field(default="auto", description="Source language code (e.g., 'en', 'hi', 'auto')")
    target_lang: str = Field(default="hi", description="Target language code (e.g., 'hi', 'en', 'es', 'fr')")
    tone: Optional[str] = Field(default="natural", description="'natural', 'formal', or 'casual'")


class TranslateResponse(BaseModel):
    original_text: str
    translated_text: str
    source_lang: str
    target_lang: str
    pronunciation: Optional[str] = None

