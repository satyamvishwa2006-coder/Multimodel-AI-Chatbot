import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.db.session import get_db
from app.db.models import Conversation, Message
from app.schemas.conversation import (
    ConversationResponse,
    ConversationSummary,
    ConversationCreate,
    ConversationRename,
    MessageFeedbackRequest,
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
        feedback=getattr(msg, "feedback", None),
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


@router.get("/search")
def search_conversations(
    q: str = Query(..., min_length=1, description="Search query string"),
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """
    Searches conversations and message contents matching the query within the current session.
    Returns matched conversations with snippet excerpts.
    """
    search_term = f"%{q.strip()}%"

    # Match in title or message content
    matches = (
        db.query(Conversation)
        .join(Message, Conversation.id == Message.conversation_id, isouter=True)
        .filter(
            Conversation.session_id == session_id,
            or_(
                Conversation.title.ilike(search_term),
                Message.content.ilike(search_term),
            )
        )
        .distinct()
        .order_by(Conversation.updated_at.desc())
        .limit(20)
        .all()
    )

    results = []
    for conv in matches:
        # Find matching snippet from messages if available
        matching_snippet = ""
        for m in conv.messages:
            if q.lower() in m.content.lower():
                idx = m.content.lower().find(q.lower())
                start = max(0, idx - 40)
                end = min(len(m.content), idx + 60)
                matching_snippet = ("..." if start > 0 else "") + m.content[start:end] + ("..." if end < len(m.content) else "")
                break

        results.append({
            "id": conv.id,
            "title": conv.title,
            "matching_snippet": matching_snippet or conv.title,
            "updated_at": conv.updated_at.isoformat(),
            "message_count": len(conv.messages),
        })

    return results


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


@router.patch("/{conversation_id}", response_model=ConversationResponse)
def rename_conversation(
    conversation_id: str,
    payload: ConversationRename,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """Rename a conversation."""
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.session_id == session_id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found or unauthorized.")

    if payload.title and payload.title.strip():
        conv.title = payload.title.strip()
        db.commit()
        db.refresh(conv)

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


@router.post("/messages/{message_id}/feedback")
def set_message_feedback(
    message_id: str,
    payload: MessageFeedbackRequest,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """Records user feedback (like/dislike) on an assistant message."""
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")

    msg.feedback = payload.feedback
    db.commit()
    return {"status": "ok", "message_id": msg.id, "feedback": msg.feedback}


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def clear_all_conversations(
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """Delete all conversations for current session."""
    db.query(Conversation).filter(Conversation.session_id == session_id).delete(synchronize_session=False)
    db.commit()
    return None
