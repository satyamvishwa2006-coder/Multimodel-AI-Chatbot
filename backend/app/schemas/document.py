from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class KnowledgeDocumentResponse(BaseModel):
    id: str
    session_id: str
    filename: str
    file_type: str
    file_size: int
    chunk_count: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentChunkResponse(BaseModel):
    id: str
    document_id: str
    chunk_index: int
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkspaceDocumentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    prompt: Optional[str] = None
    file_type: str = Field(default="docx", description="'docx', 'txt', or 'md'")
    initial_content: Optional[str] = ""


class WorkspaceDocumentEdit(BaseModel):
    document_id: str
    action: str = Field(..., description="'summarize', 'simplify', 'fix_grammar', 'translate', or 'custom'")
    instruction: Optional[str] = None
    target_language: Optional[str] = "Spanish"


class WorkspaceDocumentResponse(BaseModel):
    id: str
    session_id: str
    title: str
    file_type: str
    original_content: str
    revised_content: str
    version_number: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
