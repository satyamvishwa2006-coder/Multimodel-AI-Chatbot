import os
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response, Query
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import validate_file_upload, MAX_FILE_SIZE_BYTES
from app.db.session import get_db
from app.db.models import KnowledgeDocument, DocumentVersion
from app.schemas.document import (
    KnowledgeDocumentResponse,
    WorkspaceDocumentCreate,
    WorkspaceDocumentEdit,
    WorkspaceDocumentResponse,
)
from app.services.rag_service import RAGService
from app.services.document_service import DocumentService
from app.utils.session_helper import get_session_id

router = APIRouter(prefix="/api/documents", tags=["Documents"])


# ==============================================================
# RAG Knowledge Base Endpoints
# ==============================================================

@router.get("/rag", response_model=List[KnowledgeDocumentResponse])
def list_rag_documents(
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """List knowledge base documents for current session."""
    return db.query(KnowledgeDocument).filter(
        KnowledgeDocument.session_id == session_id
    ).order_by(KnowledgeDocument.created_at.desc()).all()


@router.post("/rag/upload", response_model=KnowledgeDocumentResponse)
async def upload_rag_document(
    file: UploadFile = File(...),
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """Upload and index a document into the RAG vector store."""
    category, clean_filename = validate_file_upload(file)
    if category != "document":
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, TXT, or MD documents can be indexed into RAG.")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_id = str(uuid.uuid4())
    _, ext = os.path.splitext(clean_filename)
    saved_path = os.path.join(settings.UPLOAD_DIR, f"rag_{file_id}{ext}")

    content = await file.read()
    file_size = len(content)
    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB}MB.")

    with open(saved_path, "wb") as f:
        f.write(content)

    doc = RAGService.ingest_document(
        db=db,
        session_id=session_id,
        filename=clean_filename,
        file_path=saved_path,
        file_type=ext.lstrip(".").lower(),
        file_size=file_size,
    )
    return doc


@router.delete("/rag/{document_id}", status_code=204)
def delete_rag_document(
    document_id: str,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """Delete a document and its chunks from the RAG store."""
    success = RAGService.delete_document(db, session_id, document_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found or unauthorized.")
    return None


# ==============================================================
# Document Workspace Endpoints
# ==============================================================

@router.get("/workspace", response_model=List[WorkspaceDocumentResponse])
def list_workspace_documents(
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """List all workspace documents for current session."""
    return db.query(DocumentVersion).filter(
        DocumentVersion.session_id == session_id
    ).order_by(DocumentVersion.updated_at.desc()).all()


@router.post("/workspace/create", response_model=WorkspaceDocumentResponse)
def create_workspace_document(
    payload: WorkspaceDocumentCreate,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """Creates a new document in the workspace from a prompt or initial text."""
    initial_text = payload.initial_content or ""
    if payload.prompt and payload.prompt.strip():
        generated = DocumentService.create_content(
            title=payload.title,
            prompt=payload.prompt,
            file_type=payload.file_type,
        )
        initial_text = generated

    new_doc = DocumentVersion(
        session_id=session_id,
        title=payload.title,
        file_type=payload.file_type,
        original_content=initial_text,
        revised_content=initial_text,
        version_number=1,
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    return new_doc


@router.post("/workspace/edit", response_model=WorkspaceDocumentResponse)
def edit_workspace_document(
    payload: WorkspaceDocumentEdit,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """Applies AI transformation to an existing workspace document."""
    doc = db.query(DocumentVersion).filter(
        DocumentVersion.id == payload.document_id,
        DocumentVersion.session_id == session_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Workspace document not found or unauthorized.")

    revised_text = DocumentService.edit_content(
        content=doc.revised_content or doc.original_content,
        action=payload.action,
        instruction=payload.instruction,
        target_language=payload.target_language,
    )

    doc.revised_content = revised_text
    doc.version_number += 1
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/workspace/{document_id}/download")
def download_workspace_document(
    document_id: str,
    format: str = Query("docx", description="'docx', 'md', or 'txt'"),
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """Downloads the revised workspace document."""
    doc = db.query(DocumentVersion).filter(
        DocumentVersion.id == document_id,
        DocumentVersion.session_id == session_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Workspace document not found.")

    content = doc.revised_content or doc.original_content
    data_bytes, media_type, filename = DocumentService.export_document_bytes(
        content=content,
        title=doc.title,
        format_type=format,
    )

    return Response(
        content=data_bytes,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
