"""Health check endpoint tests."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check_returns_ok(client_no_db: AsyncClient) -> None:
    """Test health check endpoint returns ok status."""
    response = await client_no_db.get("/healthz")
    
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert "ts" in data
    # Verify ISO8601 format
    assert "T" in data["ts"]


@pytest.mark.asyncio
async def test_health_check_includes_request_id(client_no_db: AsyncClient) -> None:
    """Test health check response includes X-Request-ID header."""
    response = await client_no_db.get("/healthz")
    
    assert response.status_code == 200
    assert "X-Request-ID" in response.headers
    # Verify UUID format (36 chars with hyphens)
    request_id = response.headers["X-Request-ID"]
    assert len(request_id) == 36
    assert request_id.count("-") == 4
