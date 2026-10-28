def test_health_check(client):
    """Test that the /api/health endpoint returns 200 OK and valid status info."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "app_name" in data
    assert "database" in data
    assert "providers" in data


def test_root_welcome(client):
    """Test that the root endpoint returns a helpful greeting."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert data["health"] == "/api/health"
