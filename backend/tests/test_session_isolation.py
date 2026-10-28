def test_anonymous_session_isolation(client):
    """Test that Session A and Session B cannot access each other's conversations."""
    session_a = {"x-session-id": "session-alice-111"}
    session_b = {"x-session-id": "session-bob-222"}

    # Alice creates a conversation
    res_a = client.post(
        "/api/conversations",
        json={"title": "Alice Secret Project"},
        headers=session_a,
    )
    assert res_a.status_code == 201
    conv_a_id = res_a.json()["id"]

    # Bob lists conversations - Alice's conversation must not be visible
    bob_list = client.get("/api/conversations", headers=session_b)
    assert bob_list.status_code == 200
    assert not any(c["id"] == conv_a_id for c in bob_list.json())

    # Bob attempts to get Alice's conversation - must return 404
    bob_get = client.get(f"/api/conversations/{conv_a_id}", headers=session_b)
    assert bob_get.status_code == 404

    # Bob attempts to delete Alice's conversation - must return 404
    bob_delete = client.delete(f"/api/conversations/{conv_a_id}", headers=session_b)
    assert bob_delete.status_code == 404
