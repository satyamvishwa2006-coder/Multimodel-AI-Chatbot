from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.conversation import MessageAttachment, SourceCitation, RAGCitation, MessageSchema


class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: str = Field(..., min_length=1, description="User message text")
    attachments: List[MessageAttachment] = []
    enable_web_search: bool = False
    enable_rag: bool = True
    enable_tts: bool = False


class ChatResponse(BaseModel):
    conversation_id: str
    user_message: MessageSchema
    assistant_message: MessageSchema
    sources: List[SourceCitation] = []
    rag_citations: List[RAGCitation] = []
    audio_url: Optional[str] = None
