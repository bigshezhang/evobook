"""Profile API endpoints.

This module provides endpoints for retrieving and updating
the authenticated user's profile.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.exceptions import AppException
from app.domain.services.profile_service import ProfileService
from app.infrastructure.database import get_db_session

router = APIRouter(prefix="/profile", tags=["profile"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class ProfileResponse(BaseModel):
    """Full profile response."""

    id: str
    display_name: str | None = None
    mascot: str | None = None
    onboarding_completed: bool
    created_at: str
    updated_at: str


class ProfileUpdateRequest(BaseModel):
    """Request body for PATCH profile. All fields are optional."""

    display_name: str | None = Field(default=None, description="User display name")
    mascot: str | None = Field(default=None, description="Selected mascot identifier")
    onboarding_completed: bool | None = Field(
        default=None, description="Whether onboarding is completed"
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=ProfileResponse)
async def get_profile(
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict:
    """Get the authenticated user's profile.

    Args:
        user_id: Authenticated user ID from JWT.
        db: Database session.

    Returns:
        The user's profile data.
    """
    try:
        return await ProfileService.get_profile(user_id=user_id, db=db)
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": str(e)},
        )


@router.patch("", response_model=ProfileResponse)
async def update_profile(
    request: ProfileUpdateRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict:
    """Update the authenticated user's profile.

    Only fields present in the request body will be updated.

    Args:
        request: Partial profile update payload.
        user_id: Authenticated user ID from JWT.
        db: Database session.

    Returns:
        The full updated profile.
    """
    try:
        # Build updates dict with only provided (non-None) fields
        updates = request.model_dump(exclude_none=True)
        if not updates:
            # Nothing to update — just return current profile
            return await ProfileService.get_profile(user_id=user_id, db=db)

        return await ProfileService.update_profile(
            user_id=user_id,
            updates=updates,
            db=db,
        )
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": str(e)},
        )
