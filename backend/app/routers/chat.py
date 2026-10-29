import json
import os
import re
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db
from app.db.models import Conversation, Message, UserPreference
from app.schemas.chat import ChatRequest, ChatResponse, RegenerateRequest
from app.schemas.conversation import MessageSchema, MessageAttachment, SourceCitation, RAGCitation
from app.services.safety_service import SafetyService
from app.services.llm_service import get_llm_provider
from app.services.rag_service import RAGService
from app.services.web_search_service import WebSearchService
from app.services.audio_service import AudioService
from app.services.document_service import DocumentService
from app.services.image_service import ImageService
from app.services.video_service import VideoService
from app.services.code_service import CodeService
from app.utils.session_helper import get_session_id

router = APIRouter(prefix="/api/chat", tags=["Chat"])


def _build_system_prompt_with_preferences(db: Session, session_id: str) -> str:
    """Combines base empathetic multilingual system prompt with user preferences and memory."""
    base_prompt = SafetyService.get_system_prompt()
    pref = db.query(UserPreference).filter(UserPreference.session_id == session_id).first()
    if pref:
        addons = []
        if pref.custom_instructions:
            addons.append(f"USER CUSTOM INSTRUCTIONS: {pref.custom_instructions}")
        if pref.preferred_tone:
            addons.append(f"PREFERRED TONE: {pref.preferred_tone}")
        if pref.preferred_language and pref.preferred_language != "auto":
            addons.append(f"MANDATORY LANGUAGE: Always respond in {pref.preferred_language}.")
        if pref.memory_notes:
            addons.append(f"PERSISTENT USER CONTEXT/NOTES: {pref.memory_notes}")
        if addons:
            base_prompt += "\n\n### USER PERSONALIZATION & MEMORY PREFERENCES:\n" + "\n".join(addons)
    return base_prompt


def _process_attachments(attachments: List[MessageAttachment], db: Session, session_id: str):
    """
    Extracts images, video keyframes, audio transcripts, and document texts from message attachments.
    """
    image_paths = []
    attached_doc_chunks = []
    rag_citations = []

    for att in attachments:
        f_type = (att.file_type or "").lower().lstrip(".")
        if f_type in ["png", "jpg", "jpeg", "webp", "gif"] and att.file_path and os.path.exists(att.file_path):
            image_paths.append(att.file_path)
        elif f_type in ["mp4", "webm", "mov", "avi"] and att.file_path and os.path.exists(att.file_path):
            # Extract video keyframes and metadata
            try:
                keyframes = VideoService.extract_keyframes(att.file_path, max_frames=6)
                meta = VideoService.get_video_metadata(att.file_path)
                frame_paths = []
                for idx, kf in enumerate(keyframes):
                    frame_fn = f"frame_{uuid.uuid4()[:8]}_{idx}.jpg"
                    frame_path = os.path.join(settings.UPLOAD_DIR, frame_fn)
                    with open(frame_path, "wb") as f:
                        f.write(kf["jpeg_bytes"])
                    image_paths.append(frame_path)
                    frame_paths.append(f"[{kf['timestamp_str']}]")
                attached_doc_chunks.append({
                    "document_name": f"Video ({att.filename})",
                    "chunk_index": 0,
                    "snippet": f"Video: {meta['resolution']}, {meta['duration_seconds']}s long. Keyframes extracted at: {', '.join(frame_paths)}.",
                })
                rag_citations.append(RAGCitation(
                    document_name=att.filename,
                    chunk_index=0,
                    snippet=f"Video metadata: {meta['resolution']}, {meta['duration_seconds']}s duration.",
                ))
            except Exception:
                pass
        elif f_type in ["pdf", "docx", "txt", "md", "csv", "xlsx"] and att.file_path and os.path.exists(att.file_path):
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
        elif f_type in ["py", "js", "ts", "html", "css", "json", "sql", "java", "cpp", "c", "xml", "yaml", "sh"] and att.file_path and os.path.exists(att.file_path):
            try:
                with open(att.file_path, "r", encoding="utf-8", errors="ignore") as f:
                    code_text = f.read()
                if code_text:
                    attached_doc_chunks.append({
                        "document_name": f"Source Code ({att.filename})",
                        "chunk_index": 0,
                        "snippet": f"```{f_type}\n{code_text[:4000]}\n```",
                    })
                    rag_citations.append(RAGCitation(
                        document_name=att.filename,
                        chunk_index=0,
                        snippet=f"Code file: {att.filename} ({len(code_text.splitlines())} lines)",
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

    return image_paths, attached_doc_chunks, rag_citations


@router.post("", response_model=ChatResponse)
async def send_chat_message(
    payload: ChatRequest,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """
    Main multimodal chat endpoint:
    - Crisis evaluation & emotional safety check
    - Video & Image generation intent detection
    - Conversation persistence
    - RAG document context retrieval & Web search augmentation
    - Multimodal frame and image vision processing
    - Personalization and multi-turn context
    - Multilingual compliance (Hindi & universal languages)
    """
    is_crisis, crisis_text = SafetyService.check_crisis(payload.message)

    # 1. Find or create conversation
    conv = None
    if payload.conversation_id:
        conv = db.query(Conversation).filter(
            Conversation.id == payload.conversation_id,
            Conversation.session_id == session_id,
        ).first()

    if not conv:
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

    # 2. Save User Message
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

    # Crisis check response
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

    # 3. Check for Video Generation Intent
    is_vid_gen, vid_prompt = VideoService.is_video_generation_request(payload.message)
    if is_vid_gen:
        vid_result = VideoService.generate_video(prompt=vid_prompt, duration_seconds=4, aspect_ratio="16:9")
        generated_att = MessageAttachment(
            id=str(uuid.uuid4()),
            filename=vid_result["filename"],
            file_type="mp4",
            file_path=os.path.join(settings.UPLOAD_DIR, vid_result["filename"]),
            file_size=os.path.getsize(os.path.join(settings.UPLOAD_DIR, vid_result["filename"])) if os.path.exists(os.path.join(settings.UPLOAD_DIR, vid_result["filename"])) else 1024,
            url=vid_result["video_url"],
        )
        is_hindi = bool(re.search(r"[\u0900-\u097F]", payload.message))
        if is_hindi:
            assistant_reply = (
                f"मैंने आपके प्रॉम्प्ट के आधार पर AI वीडियो तैयार कर दिया है:\n\n"
                f"> **\"{vid_prompt}\"**\n\n"
                f"- **अवधि**: {vid_result['duration_seconds']} सेकंड ({vid_result['aspect_ratio']})\n"
                f"- **इंजन**: {vid_result['provider']}\n\n"
                f"आप इसे नीचे सीधे देख और डाउनलोड कर सकते हैं!"
            )
        else:
            assistant_reply = (
                f"Here is the AI video generated for you based on your prompt:\n\n"
                f"> **\"{vid_prompt}\"**\n\n"
                f"- **Duration**: {vid_result['duration_seconds']}s ({vid_result['aspect_ratio']})\n"
                f"- **Engine**: {vid_result['provider']}\n\n"
                f"You can play and preview it below or download the MP4 file."
            )
        assistant_msg = Message(
            conversation_id=conv.id,
            role="assistant",
            content=assistant_reply,
            attachments=json.dumps([generated_att.model_dump()]),
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

    # 4. Check for Image Generation Intent
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
        is_hindi = bool(re.search(r"[\u0900-\u097F]", payload.message))
        if is_hindi:
            assistant_reply = (
                f"मैंने आपके लिए यह चित्र तैयार किया है:\n\n"
                f"> **\"{img_prompt}\"**\n\n"
                f"*(संचालित: {img_result['provider']})*\n\n"
                f"यदि आप इसमें कोई बदलाव या नया चित्र चाहते हैं, तो अवश्य बताएं!"
            )
        else:
            assistant_reply = (
                f"Here is the image I generated for you based on your prompt:\n\n"
                f"> **\"{img_prompt}\"**\n\n"
                f"*(Powered by {img_result['provider']})*\n\n"
                f"Feel free to request another variation, different colors, or a new concept!"
            )
        assistant_msg = Message(
            conversation_id=conv.id,
            role="assistant",
            content=assistant_reply,
            attachments=json.dumps([generated_att.model_dump()]),
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

    # 5. Context Gathering: RAG
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

    # 6. Context Gathering: Web Search
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

    # 7. Extract multimodal attachments
    image_paths, attached_doc_chunks, file_citations = _process_attachments(payload.attachments, db, session_id)
    rag_citations.extend(file_citations)
    all_context_chunks = rag_chunks + attached_doc_chunks

    # 8. Build conversation history
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

    # 9. Formulate system prompt with preferences
    custom_system_prompt = _build_system_prompt_with_preferences(db, session_id)

    # 10. Generate response via LLM
    llm = get_llm_provider()
    response_text = llm.generate_response(
        messages=history_messages,
        system_prompt=custom_system_prompt,
        context_chunks=all_context_chunks if all_context_chunks else None,
        web_search_results=web_results if web_results else None,
        images=image_paths if image_paths else None,
    )

    # 11. Optional TTS audio synthesis
    audio_url = None
    if payload.enable_tts:
        audio_url = AudioService.synthesize(response_text)

    # 12. Save Assistant message
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


@router.post("/stream")
async def stream_chat_message(
    payload: ChatRequest,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """
    Server-Sent Events (SSE) streaming chat endpoint.
    Yields live tokens as JSON events and finishes with a completion payload.
    """
    is_crisis, crisis_text = SafetyService.check_crisis(payload.message)

    # Find or create conversation
    conv = None
    if payload.conversation_id:
        conv = db.query(Conversation).filter(
            Conversation.id == payload.conversation_id,
            Conversation.session_id == session_id,
        ).first()

    if not conv:
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

    # Save User Message
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

    # If crisis, stream directly
    if is_crisis and crisis_text:
        async def crisis_streamer():
            words = crisis_text.split(" ")
            for w in words:
                yield f"data: {json.dumps({'type': 'token', 'token': w + ' '})}\n\n"
            # save
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
            yield f"data: {json.dumps({'type': 'done', 'conversation_id': conv.id, 'assistant_message': {'id': assistant_msg.id, 'role': 'assistant', 'content': crisis_text}})}\n\n"

        return StreamingResponse(crisis_streamer(), media_type="text/event-stream")

    # Image / Video Generation check
    is_vid_gen, vid_prompt = VideoService.is_video_generation_request(payload.message)
    is_img_gen, img_prompt = ImageService.is_image_generation_request(payload.message)

    if is_vid_gen or is_img_gen:
        # Non-streaming generator for media tasks
        async def media_streamer():
            if is_vid_gen:
                yield f"data: {json.dumps({'type': 'token', 'token': 'Synthesizing your AI video... '})}\n\n"
                vid_result = VideoService.generate_video(prompt=vid_prompt, duration_seconds=4, aspect_ratio="16:9")
                generated_att = MessageAttachment(
                    id=str(uuid.uuid4()),
                    filename=vid_result["filename"],
                    file_type="mp4",
                    file_path=os.path.join(settings.UPLOAD_DIR, vid_result["filename"]),
                    file_size=os.path.getsize(os.path.join(settings.UPLOAD_DIR, vid_result["filename"])) if os.path.exists(os.path.join(settings.UPLOAD_DIR, vid_result["filename"])) else 1024,
                    url=vid_result["video_url"],
                )
                text = f"Here is the generated AI video based on: \"{vid_prompt}\""
                assistant_msg = Message(
                    conversation_id=conv.id,
                    role="assistant",
                    content=text,
                    attachments=json.dumps([generated_att.model_dump()]),
                )
                db.add(assistant_msg)
                db.commit()
                db.refresh(assistant_msg)
                yield f"data: {json.dumps({'type': 'token', 'token': '\n\nVideo rendered successfully!'})}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'conversation_id': conv.id, 'assistant_message': {'id': assistant_msg.id, 'role': 'assistant', 'content': text, 'attachments': [generated_att.model_dump()]}})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'token', 'token': 'Generating your image... '})}\n\n"
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
                text = f"Here is the generated image for: \"{img_prompt}\""
                assistant_msg = Message(
                    conversation_id=conv.id,
                    role="assistant",
                    content=text,
                    attachments=json.dumps([generated_att.model_dump()]),
                )
                db.add(assistant_msg)
                db.commit()
                db.refresh(assistant_msg)
                yield f"data: {json.dumps({'type': 'done', 'conversation_id': conv.id, 'assistant_message': {'id': assistant_msg.id, 'role': 'assistant', 'content': text, 'attachments': [generated_att.model_dump()]}})}\n\n"

        return StreamingResponse(media_streamer(), media_type="text/event-stream")

    # Gather contexts
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

    image_paths, attached_doc_chunks, file_citations = _process_attachments(payload.attachments, db, session_id)
    rag_citations.extend(file_citations)
    all_context_chunks = rag_chunks + attached_doc_chunks

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

    custom_system_prompt = _build_system_prompt_with_preferences(db, session_id)
    llm = get_llm_provider()

    async def chat_streamer():
        collected_tokens = []
        try:
            for token in llm.generate_response_stream(
                messages=history_messages,
                system_prompt=custom_system_prompt,
                context_chunks=all_context_chunks if all_context_chunks else None,
                web_search_results=web_results if web_results else None,
                images=image_paths if image_paths else None,
            ):
                collected_tokens.append(token)
                yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"

            full_reply = "".join(collected_tokens)
            audio_url = None
            if payload.enable_tts:
                audio_url = AudioService.synthesize(full_reply)

            # Persist assistant reply
            sources_json = json.dumps([s.model_dump() for s in source_citations])
            rag_json = json.dumps([r.model_dump() for r in rag_citations])
            assistant_msg = Message(
                conversation_id=conv.id,
                role="assistant",
                content=full_reply,
                sources=sources_json,
                rag_citations=rag_json,
                audio_url=audio_url,
            )
            db.add(assistant_msg)
            db.commit()
            db.refresh(assistant_msg)

            yield f"data: {json.dumps({'type': 'done', 'conversation_id': conv.id, 'assistant_message': {'id': assistant_msg.id, 'role': 'assistant', 'content': full_reply, 'audio_url': audio_url, 'created_at': assistant_msg.created_at.isoformat() if assistant_msg.created_at else None}, 'sources': [s.model_dump() for s in source_citations], 'rag_citations': [r.model_dump() for r in rag_citations]})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(chat_streamer(), media_type="text/event-stream")


@router.post("/regenerate", response_model=ChatResponse)
async def regenerate_message(
    payload: RegenerateRequest,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """
    Regenerates the last assistant response in a conversation.
    """
    conv = db.query(Conversation).filter(
        Conversation.id == payload.conversation_id,
        Conversation.session_id == session_id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(Message.created_at.asc())
        .all()
    )
    if not messages:
        raise HTTPException(status_code=400, detail="No messages in this conversation to regenerate")

    # Find the last user message and optional previous assistant message to delete
    last_user_msg = None
    for m in reversed(messages):
        if m.role == "user":
            last_user_msg = m
            break

    if not last_user_msg:
        raise HTTPException(status_code=400, detail="No user message found to regenerate response for")

    # If the last message is an assistant message, delete it to replace
    if messages[-1].role == "assistant":
        db.delete(messages[-1])
        db.commit()

    # Re-run chat generation for that last user message
    user_attachments = []
    if last_user_msg.attachments:
        try:
            raw_att = json.loads(last_user_msg.attachments)
            user_attachments = [MessageAttachment(**a) for a in raw_att]
        except Exception:
            pass

    chat_req = ChatRequest(
        conversation_id=conv.id,
        message=last_user_msg.content,
        attachments=user_attachments,
        enable_web_search=payload.enable_web_search,
        enable_rag=payload.enable_rag,
        enable_tts=payload.enable_tts,
    )

    # Avoid duplicating user message by calling internal logic or creating response directly
    custom_system_prompt = _build_system_prompt_with_preferences(db, session_id)
    image_paths, attached_doc_chunks, file_citations = _process_attachments(user_attachments, db, session_id)

    rag_chunks = []
    rag_citations = list(file_citations)
    if payload.enable_rag:
        retrieved = RAGService.retrieve_relevant_chunks(db, session_id, last_user_msg.content, top_k=settings.TOP_K_RETRIEVAL)
        for r in retrieved:
            rag_chunks.append(r)
            rag_citations.append(RAGCitation(
                document_name=r["document_name"],
                chunk_index=r["chunk_index"],
                snippet=r["snippet"][:150] + "...",
            ))

    web_results = []
    source_citations = []
    if payload.enable_web_search:
        search_data = await WebSearchService.search(last_user_msg.content, max_results=4)
        for s in search_data.get("results", []):
            web_results.append(s)
            source_citations.append(SourceCitation(
                title=s.get("title", "Source"),
                url=s.get("url", ""),
                snippet=s.get("snippet", ""),
            ))

    all_context = rag_chunks + attached_doc_chunks
    history_messages = [{"role": m.role, "content": m.content} for m in messages if m.role == "user" or m.id != messages[-1].id]

    llm = get_llm_provider()
    response_text = llm.generate_response(
        messages=history_messages,
        system_prompt=custom_system_prompt,
        context_chunks=all_context if all_context else None,
        web_search_results=web_results if web_results else None,
        images=image_paths if image_paths else None,
    )

    audio_url = None
    if payload.enable_tts:
        audio_url = AudioService.synthesize(response_text)

    assistant_msg = Message(
        conversation_id=conv.id,
        role="assistant",
        content=response_text,
        sources=json.dumps([s.model_dump() for s in source_citations]),
        rag_citations=json.dumps([r.model_dump() for r in rag_citations]),
        audio_url=audio_url,
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    return ChatResponse(
        conversation_id=conv.id,
        user_message=MessageSchema(
            id=last_user_msg.id,
            conversation_id=last_user_msg.conversation_id,
            role=last_user_msg.role,
            content=last_user_msg.content,
            attachments=user_attachments,
            sources=[],
            rag_citations=[],
            audio_url=None,
            created_at=last_user_msg.created_at,
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
