"""Discovery API endpoints.

This module provides API endpoints for browsing curated discovery courses.
"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.error_codes import ERROR_INTERNAL, ERROR_NOT_FOUND
from app.core.logging import get_logger
from app.domain.models.discovery_course import DiscoveryCourse
from app.infrastructure.database import get_db_session

logger = get_logger(__name__)

router = APIRouter(prefix="/discovery", tags=["discovery"])


class DiscoveryCourseResponse(BaseModel):
    """Single discovery course item."""

    id: str
    preset_id: str
    title: str
    description: str | None
    image_url: str | None
    category: str
    rating: float
    seed_context: dict[str, Any]


class DiscoveryListResponse(BaseModel):
    """Response for discovery course list."""

    courses: list[DiscoveryCourseResponse]
    total: int


class StartCourseResponse(BaseModel):
    """Response when user starts a discovery course."""

    preset_id: str
    seed_context: dict[str, Any]
    message: str = "Course added! Redirecting to onboarding..."


@router.get("/courses", response_model=DiscoveryListResponse)
async def list_discovery_courses(
    category: str | None = None,
    db: Annotated[AsyncSession, Depends(get_db_session)] = None,
) -> dict[str, Any]:
    """List discovery courses.

    Args:
        category: Optional category filter (recommended, popular, friends).
        db: Database session.

    Returns:
        List of discovery courses with total count.
    """
    try:
        # Build query
        stmt = select(DiscoveryCourse).where(DiscoveryCourse.is_active == True)

        if category:
            stmt = stmt.where(DiscoveryCourse.category == category)

        # Order by display_order within category
        stmt = stmt.order_by(
            DiscoveryCourse.category,
            DiscoveryCourse.display_order,
        )

        result = await db.execute(stmt)
        courses = result.scalars().all()

        # Convert to response format
        course_list = [
            {
                "id": str(course.id),
                "preset_id": course.preset_id,
                "title": course.title,
                "description": course.description,
                "image_url": course.image_url,
                "category": course.category,
                "rating": float(course.rating),
                "seed_context": course.seed_context,
            }
            for course in courses
        ]

        logger.info(
            "Listed discovery courses",
            category=category,
            count=len(course_list),
        )

        return {
            "courses": course_list,
            "total": len(course_list),
        }

    except Exception as e:
        logger.error(
            "Failed to list discovery courses",
            error=str(e),
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail={"code": ERROR_INTERNAL, "message": str(e)},
        )


@router.post("/courses/{preset_id}/start", response_model=StartCourseResponse)
async def start_discovery_course(
    preset_id: str,
    db: Annotated[AsyncSession, Depends(get_db_session)] = None,
) -> dict[str, Any]:
    """Mark a discovery course as started.

    This increments the start_count and returns the seed_context
    to be used in the onboarding flow.

    Args:
        preset_id: Discovery course preset ID.
        db: Database session.

    Returns:
        Seed context for onboarding.

    Raises:
        HTTPException: If course not found or error occurs.
    """
    try:
        # Find course
        stmt = select(DiscoveryCourse).where(
            DiscoveryCourse.preset_id == preset_id,
            DiscoveryCourse.is_active == True,
        )
        result = await db.execute(stmt)
        course = result.scalar_one_or_none()

        if course is None:
            logger.warning(
                "Discovery course not found",
                preset_id=preset_id,
            )
            raise HTTPException(
                status_code=404,
                detail={
                    "code": ERROR_NOT_FOUND,
                    "message": f"Discovery course '{preset_id}' not found",
                },
            )

        # Increment start_count
        stmt = (
            update(DiscoveryCourse)
            .where(DiscoveryCourse.preset_id == preset_id)
            .values(start_count=DiscoveryCourse.start_count + 1)
        )
        await db.execute(stmt)
        await db.commit()

        logger.info(
            "Discovery course started",
            preset_id=preset_id,
            title=course.title,
        )

        return {
            "preset_id": course.preset_id,
            "seed_context": course.seed_context,
            "message": "Course added! Redirecting to onboarding...",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to start discovery course",
            preset_id=preset_id,
            error=str(e),
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail={"code": ERROR_INTERNAL, "message": str(e)},
        )


@router.get("/courses/{preset_id}", response_model=DiscoveryCourseResponse)
async def get_discovery_course(
    preset_id: str,
    db: Annotated[AsyncSession, Depends(get_db_session)] = None,
) -> dict[str, Any]:
    """Get a single discovery course by preset_id.

    Args:
        preset_id: Discovery course preset ID.
        db: Database session.

    Returns:
        Discovery course details.

    Raises:
        HTTPException: If course not found.
    """
    try:
        stmt = select(DiscoveryCourse).where(
            DiscoveryCourse.preset_id == preset_id,
            DiscoveryCourse.is_active == True,
        )
        result = await db.execute(stmt)
        course = result.scalar_one_or_none()

        if course is None:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": ERROR_NOT_FOUND,
                    "message": f"Discovery course '{preset_id}' not found",
                },
            )

        logger.info(
            "Fetched discovery course",
            preset_id=preset_id,
        )

        return {
            "id": str(course.id),
            "preset_id": course.preset_id,
            "title": course.title,
            "description": course.description,
            "image_url": course.image_url,
            "category": course.category,
            "rating": float(course.rating),
            "seed_context": course.seed_context,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to fetch discovery course",
            preset_id=preset_id,
            error=str(e),
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail={"code": ERROR_INTERNAL, "message": str(e)},
        )
