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


class ActiveCourseResponse(BaseModel):
    """Response for active course endpoint."""

    course_map_id: str | None = Field(
        default=None,
        description="Active course map UUID, null if no courses exist",
    )


class SetActiveCourseRequest(BaseModel):
    """Request body for setting active course."""

    course_map_id: str = Field(..., description="Course map UUID to set as active")


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


@router.get("/active-course", response_model=ActiveCourseResponse)
async def get_active_course(
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict:
    """Get the active course map ID for the authenticated user.

    Returns the course map ID based on priority:
    1. User-set active course
    2. Last accessed course
    3. Most recently created course

    Args:
        user_id: Authenticated user ID from JWT.
        db: Database session.

    Returns:
        Active course map ID or null if no courses exist.
    """
    try:
        course_map_id = await ProfileService.get_active_course_map_id(
            user_id=user_id,
            db=db,
        )
        
        return {
            "course_map_id": str(course_map_id) if course_map_id else None,
        }
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": str(e)},
        )


@router.put("/active-course", status_code=204)
async def set_active_course(
    request: SetActiveCourseRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> None:
    """Set the active course map for the authenticated user.

    Args:
        request: Request containing the course map UUID to set as active.
        user_id: Authenticated user ID from JWT.
        db: Database session.

    Returns:
        204 No Content on success.
    """
    try:
        course_map_id = UUID(request.course_map_id)
        await ProfileService.set_active_course_map(
            user_id=user_id,
            course_map_id=course_map_id,
            db=db,
        )
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_UUID", "message": "Invalid course map UUID"},
        )
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": str(e)},
        )
