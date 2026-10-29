import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import init_db

init_db()
client = TestClient(app)


def test_video_generation_endpoint():
    headers = {"x-session-id": "test_video_sess"}
    resp = client.post(
        "/api/videos/generate",
        json={
            "prompt": "sunset over mountain lake",
            "duration_seconds": 2,
            "aspect_ratio": "16:9",
        },
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "completed"
    assert "video_url" in data
    assert data["video_url"].endswith(".mp4")
    assert data["duration_seconds"] == 2


def test_preferences_endpoints():
    headers = {"x-session-id": "test_pref_sess"}
    # GET initial
    resp = client.get("/api/preferences", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["preferred_tone"] == "empathetic"

    # UPDATE
    update_resp = client.put(
        "/api/preferences",
        json={
            "custom_instructions": "Always include code snippets.",
            "preferred_tone": "concise",
            "preferred_language": "Hindi",
            "memory_notes": "User prefers dark mode.",
        },
        headers=headers,
    )
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["preferred_tone"] == "concise"
    assert data["preferred_language"] == "Hindi"

    # CLEAR
    del_resp = client.delete("/api/preferences", headers=headers)
    assert del_resp.status_code == 204


def test_conversation_search_and_feedback():
    headers = {"x-session-id": "test_search_sess"}
    # Send message to create conversation
    chat_resp = client.post(
        "/api/chat",
        json={"message": "Python algorithms and data structures"},
        headers=headers,
    )
    assert chat_resp.status_code == 200
    conv_id = chat_resp.json()["conversation_id"]
    asst_msg_id = chat_resp.json()["assistant_message"]["id"]

    # Search conversations
    search_resp = client.get("/api/conversations/search?q=Python", headers=headers)
    assert search_resp.status_code == 200
    results = search_resp.json()
    assert len(results) >= 1

    # Rename conversation
    rename_resp = client.patch(
        f"/api/conversations/{conv_id}",
        json={"title": "Mastering Python Data Structures"},
        headers=headers,
    )
    assert rename_resp.status_code == 200
    assert rename_resp.json()["title"] == "Mastering Python Data Structures"

    # Message feedback
    fb_resp = client.post(
        f"/api/conversations/messages/{asst_msg_id}/feedback",
        json={"feedback": "like"},
        headers=headers,
    )
    assert fb_resp.status_code == 200
    assert fb_resp.json()["feedback"] == "like"
