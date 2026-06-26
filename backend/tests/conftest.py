from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client() -> TestClient:
    # TestClient runs the lifespan (Redis connect attempts + graceful fallback).
    with TestClient(create_app()) as test_client:
        yield test_client
