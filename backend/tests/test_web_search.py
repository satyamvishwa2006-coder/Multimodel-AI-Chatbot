def test_web_search_endpoint(client):
    """Test web search endpoint returns structured sources."""
    response = client.post("/api/search", json={"query": "FastAPI python tutorial", "max_results": 3})
    assert response.status_code == 200
    data = response.json()
    assert "query" in data
    assert "results" in data
    assert len(data["results"]) > 0
    assert "title" in data["results"][0]
    assert "url" in data["results"][0]


def test_chat_with_web_search(client, session_headers):
    """Test chat message with web search enabled includes source citations."""
    response = client.post(
        "/api/chat",
        json={"message": "What is the latest status of Artemis mission?", "enable_web_search": True},
        headers=session_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["sources"]) > 0
    assert "url" in data["sources"][0]
