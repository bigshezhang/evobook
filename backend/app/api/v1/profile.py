"""Profile API endpoints.

This module provides endpoints for retrieving and updating
the authenticated user's profile.
"""

import math
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes import PROFILE_PREFIX
from app.core.auth import get_current_user_id
from app.core.error_codes import (
    ERROR_INTERNAL,
    ERROR_INVALID_DAYS,
    ERROR_INVALID_PARAMETER,
    ERROR_INVALID_UUID,
    ERROR_PROFILE_NOT_FOUND,
)
from app.core.exceptions import AppException
from app.domain.repositories.course_map_repository import CourseMapRepository
from app.domain.repositories.invite_repository import InviteRepository
from app.domain.repositories.learning_activity_repository import LearningActivityRepository
from app.domain.repositories.profile_repository import ProfileRepository
from app.domain.repositories.user_stats_repository import UserStatsRepository
from app.domain.services.activity_service import ActivityService
from app.domain.services.invite_service import InviteService
from app.domain.services.profile_service import ProfileService
from app.domain.services.ranking_service import RankingService
from app.infrastructure.database import get_db_session

router = APIRouter(prefix=PROFILE_PREFIX, tags=["profile"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class ProfileResponse(BaseModel):
    """Full profile response."""

    id: str
    email: str | None = None
    display_name: str | None = None
    mascot: str | None = None
    onboarding_completed: bool
    gold_balance: int = Field(default=0, description="Gold balance")
    dice_rolls_count: int = Field(default=15, description="Dice rolls count")
    level: int = Field(default=1, description="User level")
    current_exp: int = Field(default=0, description="Current EXP")
    current_outfit: str = Field(default="default", description="Current outfit")
    travel_board_position: int = Field(default=0, description="Travel board position")
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


class LearningActivityItem(BaseModel):
    """Single learning activity item."""

    id: str
    course_map_id: str
    node_id: int
    activity_type: str
    completed_at: str = Field(..., description="ISO 8601 UTC timestamp")
    extra_data: dict | None = None


class LearningActivitiesResponse(BaseModel):
    """Response for learning activities endpoint."""

    activities: list[LearningActivityItem]
    total: int


class ProfileStatsResponse(BaseModel):
    """User learning stats response."""

    user_name: str = Field(..., description="User display name")
    joined_date: str = Field(..., description="Registration date (ISO 8601)")
    total_study_hours: int = Field(..., description="Total study hours (rounded up)")
    total_study_seconds: int = Field(..., description="Total study time (seconds)")
    completed_courses_count: int = Field(..., description="Completed courses count")
    mastered_nodes_count: int = Field(..., description="Mastered nodes count")
    global_rank: int | None = Field(..., description="Global rank (from 1)")
    rank_percentile: int | None = Field(..., description="Percentile (0-100)")
    total_users: int = Field(..., description="Total users with study time stats")
    invite_code: str = Field(..., description="User invite code (6 chars)")
    successful_invites_count: int = Field(..., description="Successful invite count")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=ProfileResponse)
async def get_profile(
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict:
    """Get the authenticated user's profile."""
    try:
        profile_repo = ProfileRepository(db)
        service = ProfileService(profile_repo=profile_repo)
        return await service.get_profile(user_id=user_id)
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": ERROR_INTERNAL, "message": str(e)})


@router.patch("", response_model=ProfileResponse)
async def update_profile(
    request: ProfileUpdateRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict:
    """Update the authenticated user's profile."""
    try:
        profile_repo = ProfileRepository(db)
        service = ProfileService(profile_repo=profile_repo)
        updates = request.model_dump(exclude_none=True)
        if not updates:
            return await service.get_profile(user_id=user_id)
        return await service.update_profile(user_id=user_id, updates=updates)
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": ERROR_INTERNAL, "message": str(e)})


@router.get("/active-course", response_model=ActiveCourseResponse)
async def get_active_course(
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict:
    """Get the active course map ID for the authenticated user."""
    try:
        profile_repo = ProfileRepository(db)
        service = ProfileService(profile_repo=profile_repo)
        course_map_id = await service.get_active_course_map_id(user_id=user_id)
        return {"course_map_id": str(course_map_id) if course_map_id else None}
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": ERROR_INTERNAL, "message": str(e)})


@router.put("/active-course", status_code=204)
async def set_active_course(
    request: SetActiveCourseRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> None:
    """Set the active course map for the authenticated user."""
    try:
        course_map_id = UUID(request.course_map_id)
        profile_repo = ProfileRepository(db)
        service = ProfileService(profile_repo=profile_repo)
        await service.set_active_course_map(user_id=user_id, course_map_id=course_map_id)
    except ValueError:
        raise HTTPException(status_code=400, detail={"code": ERROR_INVALID_UUID, "message": "Invalid course map UUID"})
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": ERROR_INTERNAL, "message": str(e)})


@router.get("/learning-activities", response_model=LearningActivitiesResponse)
async def get_learning_activities(
    days: int = 180,
    user_id: Annotated[UUID, Depends(get_current_user_id)] = None,
    db: Annotated[AsyncSession, Depends(get_db_session)] = None,
) -> dict:
    """Get user's learning activities for the past N days."""
    try:
        if days < 1 or days > 365:
            raise HTTPException(status_code=400, detail={"code": ERROR_INVALID_DAYS, "message": "days parameter must be between 1 and 365"})

        learning_activity_repo = LearningActivityRepository(db)
        course_map_repo = CourseMapRepository(db)
        user_stats_repo = UserStatsRepository(db)
        service = ActivityService(
            learning_activity_repo=learning_activity_repo,
            course_map_repo=course_map_repo,
            user_stats_repo=user_stats_repo,
        )
        activities = await service.get_user_activities(user_id=user_id, days=days)
        return {"activities": activities, "total": len(activities)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"code": ERROR_INVALID_PARAMETER, "message": str(e)})
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": ERROR_INTERNAL, "message": str(e)})


@router.get("/stats", response_model=ProfileStatsResponse)
async def get_profile_stats(
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict:
    """Get user learning statistics."""
    try:
        profile_repo = ProfileRepository(db)
        user_stats_repo = UserStatsRepository(db)
        invite_repo = InviteRepository(db)

        # 1. Get user profile
        profile = await profile_repo.find_by_id(user_id)
        if profile is None:
            raise HTTPException(status_code=404, detail={"code": ERROR_PROFILE_NOT_FOUND, "message": "User profile not found"})

        # 2. Get user stats
        stats = await user_stats_repo.find_by_user_id(user_id)

        # 3. Get ranking data
        ranking_service = RankingService(user_stats_repo=user_stats_repo)
        ranking = await ranking_service.get_user_rank(user_id=user_id)

        # 4. Get invite data
        invite_service = InviteService(invite_repo=invite_repo, profile_repo=profile_repo)
        invite_data = await invite_service.get_or_create_invite_code(user_id=user_id)

        # 5. Build response
        if stats:
            total_study_seconds = stats.total_study_seconds
            completed_courses_count = stats.completed_courses_count
            mastered_nodes_count = stats.mastered_nodes_count
        else:
            total_study_seconds = 0
            completed_courses_count = 0
            mastered_nodes_count = 0

        total_study_hours = math.ceil(total_study_seconds / 3600)

        return {
            "user_name": profile.display_name or "EvoBook Learner",
            "joined_date": profile.created_at.isoformat(),
            "total_study_hours": total_study_hours,
            "total_study_seconds": total_study_seconds,
            "completed_courses_count": completed_courses_count,
            "mastered_nodes_count": mastered_nodes_count,
            "global_rank": ranking["global_rank"],
            "rank_percentile": ranking["rank_percentile"],
            "total_users": ranking["total_users"],
            "invite_code": invite_data["invite_code"],
            "successful_invites_count": invite_data["successful_invites_count"],
        }

    except AppException:
        raise
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": ERROR_INTERNAL, "message": str(e)})
