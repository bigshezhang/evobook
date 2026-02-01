"""Health check endpoint."""

from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class HealthResponse(BaseModel):
    """Health check response model."""
    
    ok: bool
    ts: str


@router.get("/healthz", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint.
    
    Returns:
        Health status with current timestamp.
    """
    return HealthResponse(
        ok=True,
        ts=datetime.now(timezone.utc).isoformat(),
    )
