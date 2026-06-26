"""Smoke tests: the app boots and serves with no secrets and no Redis required."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_root(client: TestClient) -> None:
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.json()["api"] == "/api/v1"


def test_health(client: TestClient) -> None:
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    # Both are booleans regardless of whether Redis / a key are present.
    assert isinstance(body["redis"], bool)
    assert isinstance(body["llm_configured"], bool)


def test_platforms_empty(client: TestClient) -> None:
    # Nothing is "known" until a run verifies and publishes it (grounding).
    resp = client.get("/api/v1/platforms")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_run_then_fetch(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/runs",
        json={"platform_name": "demo", "base_url": "https://app.example.com"},
    )
    assert resp.status_code == 201
    run = resp.json()
    assert run["platform_name"] == "demo"
    assert run["status"] in {"pending", "running", "failed", "completed", "paused"}

    listed = client.get("/api/v1/runs")
    assert listed.status_code == 200
    assert any(r["id"] == run["id"] for r in listed.json())
