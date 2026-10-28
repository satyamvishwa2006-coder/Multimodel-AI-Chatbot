import io


def test_rag_upload_query_and_delete(client, session_headers):
    """Test full RAG lifecycle: upload document, vector retrieval, and deletion."""
    doc_content = (
        "Project Apex is an experimental initiative developed in 2026. "
        "Its primary goal is to achieve 99.9% automated latency reduction "
        "across edge servers using real-time predictive caching. "
        "The project lead is Dr. Elena Vance."
    )

    file_bytes = doc_content.encode("utf-8")
    files = {"file": ("apex_project.txt", io.BytesIO(file_bytes), "text/plain")}

    # 1. Upload to RAG
    upload_res = client.post("/api/documents/rag/upload", files=files, headers=session_headers)
    assert upload_res.status_code == 200
    doc_data = upload_res.json()
    assert doc_data["filename"] == "apex_project.txt"
    assert doc_data["chunk_count"] >= 1
    doc_id = doc_data["id"]

    # 2. List RAG documents
    list_res = client.get("/api/documents/rag", headers=session_headers)
    assert list_res.status_code == 200
    assert any(d["id"] == doc_id for d in list_res.json())

    # 3. Chat with RAG enabled
    chat_res = client.post(
        "/api/chat",
        json={"message": "What is the primary goal of Project Apex?", "enable_rag": True},
        headers=session_headers,
    )
    assert chat_res.status_code == 200
    chat_data = chat_res.json()
    assert len(chat_data["rag_citations"]) > 0
    assert "apex_project.txt" in chat_data["rag_citations"][0]["document_name"]

    # 4. Delete document
    del_res = client.delete(f"/api/documents/rag/{doc_id}", headers=session_headers)
    assert del_res.status_code == 204

    # Verify list is empty
    list_after = client.get("/api/documents/rag", headers=session_headers)
    assert not any(d["id"] == doc_id for d in list_after.json())
