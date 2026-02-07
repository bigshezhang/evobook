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
from app.domain.services.activity_service import ActivityService
from app.domain.services.profile_service import ProfileService
from app.domain.services.ranking_service import RankingService
from app.domain.models.user_stats import UserStats
from app.infrastructure.database import get_db_session
from sqlalchemy import select

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
    """用户学习统计响应。"""

    total_study_hours: int = Field(..., description="总学习时长（小时，向上取整）")
    total_study_seconds: int = Field(..., description="总学习时长（秒）")
    completed_courses_count: int = Field(..., description="已完成课程数（100% 完成的课程数量）")
    mastered_nodes_count: int = Field(..., description="已掌握节点数（保留字段，暂未使用）")
    global_rank: int | None = Field(..., description="全局排名（从 1 开始），如果无数据则为 None")
    rank_percentile: int | None = Field(..., description="百分位（0-100），如果无数据则为 None")
    total_users: int = Field(..., description="系统中有学习时长统计的总用户数")


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


@router.get("/learning-activities", response_model=LearningActivitiesResponse)
async def get_learning_activities(
    days: int = 180,
    user_id: Annotated[UUID, Depends(get_current_user_id)] = None,
    db: Annotated[AsyncSession, Depends(get_db_session)] = None,
) -> dict:
    """Get user's learning activities for the past N days.

    Returns raw UTC timestamps. Frontend handles timezone conversion and aggregation.

    Args:
        days: Number of days to look back (default: 180, max: 365).
        user_id: Authenticated user ID from JWT.
        db: Database session.

    Returns:
        List of learning activities with UTC timestamps.
    """
    try:
        if days < 1 or days > 365:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INVALID_DAYS",
                    "message": "days parameter must be between 1 and 365",
                },
            )

        activities = await ActivityService.get_user_activities(
            user_id=user_id,
            days=days,
            db=db,
        )

        return {
            "activities": activities,
            "total": len(activities),
        }
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_PARAMETER", "message": str(e)},
        )
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": str(e)},
        )


@router.get("/stats", response_model=ProfileStatsResponse)
async def get_profile_stats(
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict:
    """获取用户学习统计数据。
    
    包括：
    - 总学习时长（小时和秒）
    - 已完成课程数
    - 已掌握节点数
    - 全局排名和百分位
    
    Args:
        user_id: 认证用户 ID（从 JWT 提取）
        db: 数据库会话
    
    Returns:
        ProfileStatsResponse: 用户学习统计数据
    
    Raises:
        401: 未认证
        500: 内部错误
    """
    try:
        # 1. 获取用户统计数据
        stats_stmt = select(UserStats).where(UserStats.user_id == user_id)
        stats_result = await db.execute(stats_stmt)
        stats = stats_result.scalar_one_or_none()
        
        # 2. 获取排名数据
        ranking = await RankingService.get_user_rank(user_id=user_id, db=db)
        
        # 3. 构建响应
        if stats:
            total_study_seconds = stats.total_study_seconds
            completed_courses_count = stats.completed_courses_count
            mastered_nodes_count = stats.mastered_nodes_count
        else:
            total_study_seconds = 0
            completed_courses_count = 0
            mastered_nodes_count = 0
        
        # 向上取整计算小时数
        import math
        total_study_hours = math.ceil(total_study_seconds / 3600)
        
        return {
            "total_study_hours": total_study_hours,
            "total_study_seconds": total_study_seconds,
            "completed_courses_count": completed_courses_count,
            "mastered_nodes_count": mastered_nodes_count,
            "global_rank": ranking["global_rank"],
            "rank_percentile": ranking["rank_percentile"],
            "total_users": ranking["total_users"],
        }
    
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": str(e)},
        )
