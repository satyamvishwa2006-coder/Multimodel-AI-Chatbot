import json
import os
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db
from app.db.models import Conversation, Message
from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.conversation import MessageSchema, MessageAttachment, SourceCitation, RAGCitation
from app.services.safety_service import SafetyService
from app.services.llm_service import get_llm_provider
from app.services.rag_service import RAGService
from app.services.web_search_service import WebSearchService
from app.services.audio_service import AudioService
from app.services.document_service import DocumentService
from app.services.image_service import ImageService
from app.utils.session_helper import get_session_id

router = APIRouter(prefix="/api/chat", tags=["Chat"])


@router.post("", response_model=ChatResponse)
async def send_chat_message(
    payload: ChatRequest,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """
    Main multimodal chat endpoint:
    - Crisis evaluation & emotional safety check
    - Conversation persistence
    - RAG document context retrieval
    - Web search augmentation
    - Vision model routing for images
    - Optional TTS audio synthesis
    """
    # 1. Emotional support crisis check
    is_crisis, crisis_text = SafetyService.check_crisis(payload.message)

    # 2. Find or create conversation
    conv = None
    if payload.conversation_id:
        conv = db.query(Conversation).filter(
            Conversation.id == payload.conversation_id,
            Conversation.session_id == session_id,
        ).first()

    if not conv:
        # Generate initial title from first 40 chars of message
        title_snippet = payload.message.strip().replace("\n", " ")[:40]
        if len(payload.message.strip()) > 40:
            title_snippet += "..."
        conv = Conversation(
            session_id=session_id,
            title=title_snippet or "New Conversation",
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

    # 3. Save User Message
    attachments_json = json.dumps([a.model_dump() for a in payload.attachments])
    user_msg = Message(
        conversation_id=conv.id,
        role="user",
        content=payload.message,
        attachments=attachments_json,
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # If crisis was detected, respond immediately with safety guidance
    if is_crisis and crisis_text:
        assistant_msg = Message(
            conversation_id=conv.id,
            role="assistant",
            content=crisis_text,
            sources="[]",
            rag_citations="[]",
        )
        db.add(assistant_msg)
        db.commit()
        db.refresh(assistant_msg)

        return ChatResponse(
            conversation_id=conv.id,
            user_message=MessageSchema(
                id=user_msg.id,
                conversation_id=user_msg.conversation_id,
                role=user_msg.role,
                content=user_msg.content,
                attachments=payload.attachments,
                sources=[],
                rag_citations=[],
                audio_url=None,
                created_at=user_msg.created_at,
            ),
            assistant_message=MessageSchema(
                id=assistant_msg.id,
                conversation_id=assistant_msg.conversation_id,
                role=assistant_msg.role,
                content=assistant_msg.content,
                attachments=[],
                sources=[],
                rag_citations=[],
                audio_url=None,
                created_at=assistant_msg.created_at,
            ),
            sources=[],
            rag_citations=[],
            audio_url=None,
        )

    # 3b. Check for Image Generation Intent
    is_img_gen, img_prompt = ImageService.is_image_generation_request(payload.message)
    if is_img_gen:
        img_result = await ImageService.generate_image(img_prompt)
        ext = "jpg" if img_result["filename"].endswith(".jpg") else "svg"
        generated_att = MessageAttachment(
            id=str(uuid.uuid4()),
            filename=f"generated_{img_result['filename']}",
            file_type=ext,
            file_path=img_result["file_path"],
            file_size=img_result["file_size"],
            url=img_result["image_url"],
        )
        assistant_reply = (
            f"Here is the image I generated for you based on your prompt:\n\n"
            f"> **\"{img_prompt}\"**\n\n"
            f"*(Powered by {img_result['provider']})*\n\n"
            f"Feel free to request another variation, different colors, or a new concept!"
        )
        attachments_json = json.dumps([generated_att.model_dump()])
        assistant_msg = Message(
            conversation_id=conv.id,
            role="assistant",
            content=assistant_reply,
            attachments=attachments_json,
            sources="[]",
            rag_citations="[]",
            audio_url=None,
        )
        db.add(assistant_msg)
        db.commit()
        db.refresh(assistant_msg)

        return ChatResponse(
            conversation_id=conv.id,
            user_message=MessageSchema(
                id=user_msg.id,
                conversation_id=user_msg.conversation_id,
                role=user_msg.role,
                content=user_msg.content,
                attachments=payload.attachments,
                sources=[],
                rag_citations=[],
                audio_url=None,
                created_at=user_msg.created_at,
            ),
            assistant_message=MessageSchema(
                id=assistant_msg.id,
                conversation_id=assistant_msg.conversation_id,
                role=assistant_msg.role,
                content=assistant_msg.content,
                attachments=[generated_att],
                sources=[],
                rag_citations=[],
                audio_url=None,
                created_at=assistant_msg.created_at,
            ),
            sources=[],
            rag_citations=[],
            audio_url=None,
        )

    # 4. Context Gathering: RAG
    rag_chunks = []
    rag_citations = []
    if payload.enable_rag:
        retrieved = RAGService.retrieve_relevant_chunks(db, session_id, payload.message, top_k=settings.TOP_K_RETRIEVAL)
        for r in retrieved:
            rag_chunks.append(r)
            rag_citations.append(RAGCitation(
                document_name=r["document_name"],
                chunk_index=r["chunk_index"],
                snippet=r["snippet"][:150] + "...",
            ))

    # 5. Context Gathering: Web Search
    web_results = []
    source_citations = []
    if payload.enable_web_search:
        search_data = await WebSearchService.search(payload.message, max_results=4)
        for s in search_data.get("results", []):
            web_results.append(s)
            source_citations.append(SourceCitation(
                title=s.get("title", "Source"),
                url=s.get("url", ""),
                snippet=s.get("snippet", ""),
            ))

    # 6. Extract multimodal attachments (images for vision, docs for immediate grounding, audio for speech)
    image_paths = []
    attached_doc_chunks = []
    for att in payload.attachments:
        f_type = (att.file_type or "").lower().lstrip(".")
        if f_type in ["png", "jpg", "jpeg", "webp", "gif"] and att.file_path:
            image_paths.append(att.file_path)
        elif f_type in ["pdf", "docx", "txt", "md"] and att.file_path and os.path.exists(att.file_path):
            try:
                doc_text = DocumentService.extract_text(att.file_path, f_type)
                if doc_text:
                    attached_doc_chunks.append({
                        "document_name": att.filename,
                        "chunk_index": 0,
                        "snippet": doc_text[:4000],
                    })
                    rag_citations.append(RAGCitation(
                        document_name=att.filename,
                        chunk_index=0,
                        snippet=doc_text[:150] + "...",
                    ))
            except Exception:
                pass
        elif f_type in ["mp3", "wav", "m4a", "webm", "ogg"] and att.file_path and os.path.exists(att.file_path):
            try:
                transcription = AudioService.transcribe(att.file_path)
                if transcription:
                    attached_doc_chunks.append({
                        "document_name": f"Voice/Audio ({att.filename})",
                        "chunk_index": 0,
                        "snippet": transcription,
                    })
            except Exception:
                pass

    all_context_chunks = rag_chunks + attached_doc_chunks

    # 7. Build conversation history for multi-turn LLM context
    history_messages = []
    past_messages = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(Message.created_at.asc())
        .limit(10)
        .all()
    )
    for m in past_messages:
        history_messages.append({"role": m.role, "content": m.content})

    # 8. Generate response via LLM
    llm = get_llm_provider()
    response_text = llm.generate_response(
        messages=history_messages,
        context_chunks=all_context_chunks if all_context_chunks else None,
        web_search_results=web_results if web_results else None,
        images=image_paths if image_paths else None,
    )

    # 9. Optional TTS speech synthesis
    audio_url = None
    if payload.enable_tts:
        audio_url = AudioService.synthesize(response_text)

    # 10. Save Assistant message
    sources_json = json.dumps([s.model_dump() for s in source_citations])
    rag_json = json.dumps([r.model_dump() for r in rag_citations])
    assistant_msg = Message(
        conversation_id=conv.id,
        role="assistant",
        content=response_text,
        sources=sources_json,
        rag_citations=rag_json,
        audio_url=audio_url,
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    return ChatResponse(
        conversation_id=conv.id,
        user_message=MessageSchema(
            id=user_msg.id,
            conversation_id=user_msg.conversation_id,
            role=user_msg.role,
            content=user_msg.content,
            attachments=payload.attachments,
            sources=[],
            rag_citations=[],
            audio_url=None,
            created_at=user_msg.created_at,
        ),
        assistant_message=MessageSchema(
            id=assistant_msg.id,
            conversation_id=assistant_msg.conversation_id,
            role=assistant_msg.role,
            content=assistant_msg.content,
            attachments=[],
            sources=source_citations,
            rag_citations=rag_citations,
            audio_url=audio_url,
            created_at=assistant_msg.created_at,
        ),
        sources=source_citations,
        rag_citations=rag_citations,
        audio_url=audio_url,
    )
