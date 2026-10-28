def test_image_generation_api(client, session_headers):
    """Test generating an image via /api/images/generate."""
    payload = {
        "prompt": "A futuristic city with flying cars",
        "width": 512,
        "height": 512,
    }
    response = client.post("/api/images/generate", json=payload, headers=session_headers)
    assert response.status_code == 200
    data = response.json()
    assert "image_url" in data
    assert data["image_url"].startswith("/uploads/")
    assert data["prompt"] == payload["prompt"]
    assert "provider" in data


def test_chat_triggers_image_generation(client, session_headers):
    """Test that chat automatically detects an image generation request and creates image attachment."""
    payload = {
        "message": "Generate an image of an astronaut riding a horse on Mars",
    }
    response = client.post("/api/chat", json=payload, headers=session_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["assistant_message"]["attachments"]) == 1
    att = data["assistant_message"]["attachments"][0]
    assert att["url"].startswith("/uploads/")

