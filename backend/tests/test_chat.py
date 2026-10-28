def test_chat_creates_conversation_and_messages(client, session_headers):
    """Test sending a chat message without existing conversation_id creates a new conversation."""
    payload = {
        "message": "Hello assistant!",
        "attachments": [],
        "enable_web_search": False,
        "enable_rag": False,
        "enable_tts": False,
    }
    response = client.post("/api/chat", json=payload, headers=session_headers)
    assert response.status_code == 200
    data = response.json()
    assert "conversation_id" in data
    assert data["user_message"]["content"] == "Hello assistant!"
    assert data["assistant_message"]["role"] == "assistant"
    assert len(data["assistant_message"]["content"]) > 0

    conv_id = data["conversation_id"]

    # Verify conversation is persisted in conversations list
    conv_response = client.get(f"/api/conversations/{conv_id}", headers=session_headers)
    assert conv_response.status_code == 200
    conv_data = conv_response.json()
    assert len(conv_data["messages"]) == 2  # user + assistant


def test_chat_continuation(client, session_headers):
    """Test sending follow-up messages in the same conversation."""
    # First message
    res1 = client.post(
        "/api/chat",
        json={"message": "First message"},
        headers=session_headers,
    )
    conv_id = res1.json()["conversation_id"]

    # Second message
    res2 = client.post(
        "/api/chat",
        json={"conversation_id": conv_id, "message": "Second message"},
        headers=session_headers,
    )
    assert res2.status_code == 200
    assert res2.json()["conversation_id"] == conv_id

    # Verify message count is 4
    conv_res = client.get(f"/api/conversations/{conv_id}", headers=session_headers)
    assert len(conv_res.json()["messages"]) == 4
