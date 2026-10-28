import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import Conversation, Message
from app.schemas.conversation import (
    ConversationResponse,
    ConversationSummary,
    ConversationCreate,
    MessageSchema,
)
from app.utils.session_helper import get_session_id

router = APIRouter(prefix="/api/conversations", tags=["Conversations"])


def format_message(msg: Message) -> MessageSchema:
    attachments = []
    sources = []
    rag_citations = []
    try:
        attachments = json.loads(msg.attachments) if msg.attachments else []
    except Exception:
        attachments = []
    try:
        sources = json.loads(msg.sources) if msg.sources else []
    except Exception:
        sources = []
    try:
        rag_citations = json.loads(msg.rag_citations) if msg.rag_citations else []
    except Exception:
        rag_citations = []

    return MessageSchema(
        id=msg.id,
        conversation_id=msg.conversation_id,
        role=msg.role,
        content=msg.content,
        attachments=attachments,
        sources=sources,
        rag_citations=rag_citations,
        audio_url=msg.audio_url,
        created_at=msg.created_at,
    )


def format_conversation(conv: Conversation) -> ConversationResponse:
    formatted_messages = [format_message(m) for m in conv.messages]
    return ConversationResponse(
        id=conv.id,
        session_id=conv.session_id,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=formatted_messages,
    )


@router.get("", response_model=List[ConversationSummary])
def list_conversations(
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """List all conversations for current session."""
    convs = (
        db.query(Conversation)
        .filter(Conversation.session_id == session_id)
        .order_by(Conversation.updated_at.desc())
        .all()
    )
    return [
        ConversationSummary(
            id=c.id,
            session_id=c.session_id,
            title=c.title,
            created_at=c.created_at,
            updated_at=c.updated_at,
            message_count=len(c.messages),
        )
        for c in convs
    ]


@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def create_conversation(
    payload: ConversationCreate,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """Create a new conversation for current session."""
    new_conv = Conversation(
        session_id=session_id,
        title=payload.title or "New Conversation",
    )
    db.add(new_conv)
    db.commit()
    db.refresh(new_conv)
    return format_conversation(new_conv)


@router.get("/{conversation_id}", response_model=ConversationResponse)
def get_conversation(
    conversation_id: str,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """Retrieve a conversation by ID for current session."""
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.session_id == session_id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found or unauthorized.")
    return format_conversation(conv)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: str,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """Delete a conversation belonging to current session."""
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.session_id == session_id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found or unauthorized.")
    db.delete(conv)
    db.commit()
    return None


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def clear_all_conversations(
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """Delete all conversations for current session."""
    db.query(Conversation).filter(Conversation.session_id == session_id).delete(synchronize_session=False)
    db.commit()
    return None
