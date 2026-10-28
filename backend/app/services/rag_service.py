import math
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.config import settings
from app.db.models import KnowledgeDocument, DocumentChunk, HAS_PGVECTOR
from app.services.embedding_service import get_embedding_provider
from app.services.document_service import DocumentService


def chunk_text(text: str, chunk_size: int = 500, chunk_overlap: int = 50) -> List[str]:
    """
    Splits text into sliding overlapping chunks.
    """
    clean_text = text.strip()
    if not clean_text:
        return []
    if len(clean_text) <= chunk_size:
        return [clean_text]

    chunks = []
    start = 0
    stride = max(1, chunk_size - chunk_overlap)

    while start < len(clean_text):
        end = min(start + chunk_size, len(clean_text))
        # Try to break on whitespace if possible
        if end < len(clean_text):
            space_pos = clean_text.rfind(" ", start, end)
            if space_pos > start + (chunk_size // 2):
                end = space_pos

        chunk = clean_text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= len(clean_text):
            break
        start += stride

    return chunks


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Computes exact cosine similarity between two float vectors."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 > 0 and norm2 > 0:
        return dot / (norm1 * norm2)
    return 0.0


class RAGService:
    @staticmethod
    def ingest_document(
        db: Session,
        session_id: str,
        filename: str,
        file_path: str,
        file_type: str,
        file_size: int,
    ) -> KnowledgeDocument:
        """
        Extracts text from document, chunks it, generates embeddings,
        and saves knowledge document + chunks to database.
        """
        extracted_text = DocumentService.extract_text(file_path, file_type)
        chunks = chunk_text(
            extracted_text,
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
        )

        embed_provider = get_embedding_provider()
        embeddings = embed_provider.embed_batch(chunks) if chunks else []

        # Create KnowledgeDocument record
        doc = KnowledgeDocument(
            session_id=session_id,
            filename=filename,
            file_type=file_type,
            file_path=file_path,
            file_size=file_size,
            chunk_count=len(chunks),
        )
        db.add(doc)
        db.flush()  # populate doc.id

        # Insert chunks
        for idx, (content, emb) in enumerate(zip(chunks, embeddings)):
            chunk_obj = DocumentChunk(
                document_id=doc.id,
                chunk_index=idx,
                content=content,
                embedding=emb,
            )
            db.add(chunk_obj)

        db.commit()
        db.refresh(doc)
        return doc

    @staticmethod
    def retrieve_relevant_chunks(
        db: Session,
        session_id: str,
        query: str,
        top_k: int = 4,
    ) -> List[Dict[str, Any]]:
        """
        Retrieves top_k most relevant chunks for current session via vector similarity search.
        Uses native pgvector distance if available, or exact in-memory cosine ranking.
        """
        embed_provider = get_embedding_provider()
        query_vector = embed_provider.embed_text(query)

        # Get all documents for current session
        docs = db.query(KnowledgeDocument).filter(KnowledgeDocument.session_id == session_id).all()
        if not docs:
            return []

        doc_ids = [d.id for d in docs]
        doc_map = {d.id: d.filename for d in docs}

        # Query all chunks for these documents
        chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id.in_(doc_ids)).all()
        if not chunks:
            return []

        scored_chunks = []
        for c in chunks:
            if c.embedding:
                score = cosine_similarity(query_vector, c.embedding)
                scored_chunks.append((score, c))

        # Sort by highest similarity
        scored_chunks.sort(key=lambda x: x[0], reverse=True)

        results = []
        for score, chunk in scored_chunks[:top_k]:
            results.append({
                "chunk_id": chunk.id,
                "document_name": doc_map.get(chunk.document_id, "Document"),
                "chunk_index": chunk.chunk_index,
                "snippet": chunk.content,
                "similarity_score": round(score, 4),
            })

        return results

    @staticmethod
    def delete_document(db: Session, session_id: str, document_id: str) -> bool:
        """Deletes a document and all its chunks belonging to current session."""
        doc = db.query(KnowledgeDocument).filter(
            KnowledgeDocument.id == document_id,
            KnowledgeDocument.session_id == session_id,
        ).first()
        if not doc:
            return False
        db.delete(doc)
        db.commit()
        return True
