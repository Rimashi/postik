def test_version_endpoint(client, monkeypatch):
    monkeypatch.setenv("APP_VERSION", "a" * 40)
    result = client.get("/api/version")
    assert result.status_code == 200
    assert result.json() == {"version": "a" * 40}
