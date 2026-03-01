"""Discovery API endpoints.

This module provides API endpoints for browsing curated discovery courses.
"""

from datetime import datetime, timezone
from typing import Annotated, Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes import DISCOVERY_PREFIX
from app.core.auth import get_current_user_id
from app.core.error_codes import ERROR_INTERNAL, ERROR_NOT_FOUND
from app.core.logging import get_logger
from app.domain.models.course_map import CourseMap
from app.domain.models.node_content import NodeContent
from app.domain.models.node_progress import NodeProgress
from app.domain.repositories.discovery_course_repository import DiscoveryCourseRepository
from app.infrastructure.database import get_db_session

logger = get_logger(__name__)

router = APIRouter(prefix=DISCOVERY_PREFIX, tags=["discovery"])


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


class JoinCourseResponse(BaseModel):
    """Response when user joins a discovery course (full clone, no AI generation)."""

    course_map_id: str
    message: str = "Course joined! You can start learning now."


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
        discovery_repo = DiscoveryCourseRepository(db)
        courses = await discovery_repo.find_active(category=category)

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
        discovery_repo = DiscoveryCourseRepository(db)
        course = await discovery_repo.find_active_by_preset_id(preset_id)

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
        await discovery_repo.increment_start_count(preset_id)
        await discovery_repo.commit()

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
        discovery_repo = DiscoveryCourseRepository(db)
        course = await discovery_repo.find_active_by_preset_id(preset_id)

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


@router.post("/courses/{preset_id}/join", response_model=JoinCourseResponse)
async def join_discovery_course(
    preset_id: str,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)] = None,
) -> dict[str, Any]:
    """Join a discovery course by cloning its full content to the user's account.

    This creates a new CourseMap for the user, copies all pre-built NodeContent
    records from the source course_map, and initialises NodeProgress for every
    node (first layer unlocked, rest locked). No AI generation is triggered.

    Args:
        preset_id: Discovery course preset ID.
        user_id: Authenticated user UUID.
        db: Database session.

    Returns:
        The newly created course_map_id so the frontend can navigate directly
        to the learning page.
    """
    try:
        discovery_repo = DiscoveryCourseRepository(db)
        course = await discovery_repo.find_active_by_preset_id(preset_id)

        if course is None:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": ERROR_NOT_FOUND,
                    "message": f"Discovery course '{preset_id}' not found",
                },
            )

        if not course.nodes or not course.map_meta:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "COURSE_NOT_READY",
                    "message": f"Discovery course '{preset_id}' has no pre-built content yet",
                },
            )

        now = datetime.now(timezone.utc)

        # 1. Clone course_map structure for this user
        new_course_map_id = uuid4()
        seed = course.seed_context or {}
        new_course_map = CourseMap(
            id=new_course_map_id,
            user_id=user_id,
            topic=seed.get("topic", course.title),
            level=seed.get("suggested_level", "Beginner"),
            focus=seed.get("focus", ""),
            verified_concept=seed.get("verified_concept", seed.get("topic", course.title)),
            mode="Deep",
            language=seed.get("language", "en"),
            total_commitment_minutes=course.map_meta.get("total_commitment_minutes", 60),
            map_meta=course.map_meta,
            nodes=course.nodes,
            created_at=now,
        )
        db.add(new_course_map)
        await db.flush()

        # 2. Clone all pre-built NodeContent records from the source course_map
        if course.source_course_map_id is not None:
            nc_stmt = select(NodeContent).where(
                NodeContent.course_map_id == course.source_course_map_id
            )
            nc_result = await db.execute(nc_stmt)
            source_contents = nc_result.scalars().all()

            for nc in source_contents:
                new_nc = NodeContent(
                    id=uuid4(),
                    course_map_id=new_course_map_id,
                    node_id=nc.node_id,
                    content_type=nc.content_type,
                    question_key=nc.question_key,
                    content_json=nc.content_json,
                    generation_status=nc.generation_status,
                    generation_started_at=nc.generation_started_at,
                    generation_completed_at=nc.generation_completed_at,
                    generation_error=nc.generation_error,
                    node_type=nc.node_type,
                    created_at=now,
                )
                db.add(new_nc)

        # 3. Initialise NodeProgress for every node
        #    First node in layer 0 (or smallest layer) gets "unlocked"; rest get "locked"
        nodes = course.nodes
        first_node_id: int | None = None
        if nodes:
            # Find the node with no prerequisites (first in DAG)
            no_prereq = [n for n in nodes if not n.get("pre_requisites")]
            if no_prereq:
                first_node_id = no_prereq[0]["id"]
            else:
                first_node_id = nodes[0]["id"]

        for node in nodes:
            node_id = node["id"]
            status = "unlocked" if node_id == first_node_id else "locked"
            progress = NodeProgress(
                id=uuid4(),
                user_id=user_id,
                course_map_id=new_course_map_id,
                node_id=node_id,
                status=status,
                updated_at=now,
            )
            db.add(progress)

        # 4. Increment start_count on the discovery course
        await discovery_repo.increment_start_count(preset_id)

        await db.commit()

        logger.info(
            "User joined discovery course",
            preset_id=preset_id,
            user_id=str(user_id),
            new_course_map_id=str(new_course_map_id),
        )

        return {
            "course_map_id": str(new_course_map_id),
            "message": "Course joined! You can start learning now.",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to join discovery course",
            preset_id=preset_id,
            user_id=str(user_id),
            error=str(e),
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail={"code": ERROR_INTERNAL, "message": str(e)},
        )
