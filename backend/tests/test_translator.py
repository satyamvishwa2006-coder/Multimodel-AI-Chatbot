def test_translate_english_to_hindi(client):
    """Test translating English text to Hindi."""
    payload = {
        "text": "Hello, how are you today?",
        "source_lang": "en",
        "target_lang": "hi",
    }
    response = client.post("/api/translate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "translated_text" in data
    assert len(data["translated_text"]) > 0
    assert data["target_lang"] == "hi"


def test_translate_empty_rejected(client):
    """Test translating empty text returns 400 error."""
    payload = {"text": "   "}
    response = client.post("/api/translate", json=payload)
    assert response.status_code == 400

