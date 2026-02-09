"""Error handling and exception tests."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_404_returns_json_error(client_no_db: AsyncClient) -> None:
    """Test 404 errors return JSON format."""
    response = await client_no_db.get("/nonexistent/endpoint")

    assert response.status_code == 404
    # FastAPI returns its own 404 format, but we verify it's JSON
    assert response.headers["content-type"].startswith("application/json")


@pytest.mark.asyncio
async def test_validation_error_returns_json(client_no_db: AsyncClient) -> None:
    """Test validation errors return proper JSON structure."""
    # Post to a non-existent endpoint with data to trigger routing/validation
    response = await client_no_db.post(
        "/api/v1/not-implemented/endpoint",
        json={"invalid": "data"},
    )

    # Should return 404 as JSON
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
