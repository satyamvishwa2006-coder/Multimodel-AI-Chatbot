def test_workspace_crud_and_edit(client, session_headers):
    """Test creating a workspace document, applying an AI edit, and downloading."""
    # 1. Create document
    create_res = client.post(
        "/api/documents/workspace/create",
        json={
            "title": "Quarterly Plan",
            "prompt": "Create an executive strategy outline for Q4.",
            "file_type": "docx",
        },
        headers=session_headers,
    )
    assert create_res.status_code == 200
    doc_data = create_res.json()
    doc_id = doc_data["id"]
    assert doc_data["title"] == "Quarterly Plan"
    assert doc_data["version_number"] == 1
    assert len(doc_data["original_content"]) > 0

    # 2. Edit document (summarize)
    edit_res = client.post(
        "/api/documents/workspace/edit",
        json={
            "document_id": doc_id,
            "action": "summarize",
        },
        headers=session_headers,
    )
    assert edit_res.status_code == 200
    revised_data = edit_res.json()
    assert revised_data["version_number"] == 2
    assert len(revised_data["revised_content"]) > 0

    # 3. Download as markdown
    down_md = client.get(
        f"/api/documents/workspace/{doc_id}/download?format=md",
        headers=session_headers,
    )
    assert down_md.status_code == 200
    assert "text/markdown" in down_md.headers["content-type"]

    # 4. Download as DOCX
    down_docx = client.get(
        f"/api/documents/workspace/{doc_id}/download?format=docx",
        headers=session_headers,
    )
    assert down_docx.status_code == 200
    assert "application/vnd.openxmlformats" in down_docx.headers["content-type"]
