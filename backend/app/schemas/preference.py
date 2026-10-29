from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class UserPreferenceUpdate(BaseModel):
    custom_instructions: Optional[str] = Field(default="", description="Custom user instructions for the AI")
    preferred_tone: Optional[str] = Field(default="empathetic", description="Response tone: empathetic, concise, professional, creative")
    preferred_language: Optional[str] = Field(default="auto", description="Preferred response language code")
    memory_notes: Optional[str] = Field(default="", description="Explicit user memory notes")


class UserPreferenceResponse(BaseModel):
    id: str
    session_id: str
    custom_instructions: str
    preferred_tone: str
    preferred_language: str
    memory_notes: str
    created_at: datetime
    updated_at: datetime

