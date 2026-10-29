from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class MessageAttachment(BaseModel):
    id: str
    filename: str
    file_type: str
    file_path: str
    file_size: int
    url: Optional[str] = None


class SourceCitation(BaseModel):
    title: str
    url: str
    snippet: str


class RAGCitation(BaseModel):
    document_name: str
    chunk_index: int
    snippet: str


class MessageSchema(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    attachments: List[MessageAttachment] = []
    sources: List[SourceCitation] = []
    rag_citations: List[RAGCitation] = []
    audio_url: Optional[str] = None
    feedback: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationCreate(BaseModel):
    title: Optional[str] = "New Conversation"


class ConversationRename(BaseModel):
    title: str


class MessageFeedbackRequest(BaseModel):
    feedback: Optional[str] = "like"  # "like", "dislike", None


class ConversationResponse(BaseModel):
    id: str
    session_id: str
    title: str
    created_at: datetime
    updated_at: datetime
    messages: List[MessageSchema] = []

    model_config = ConfigDict(from_attributes=True)


class ConversationSummary(BaseModel):
    id: str
    session_id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    model_config = ConfigDict(from_attributes=True)
