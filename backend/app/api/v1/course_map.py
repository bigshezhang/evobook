"""Course map API endpoints.

This module provides API endpoints for generating and retrieving course map DAGs.
"""

from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.auth import get_current_user_id, get_optional_user_id
from app.core.exceptions import AppException, NotFoundError
from app.core.logging import get_logger
from app.domain.models.course_map import CourseMap
from app.domain.services.course_map_service import CourseMapService
from app.domain.services.profile_service import ProfileService
from app.infrastructure.database import get_db_session
from app.llm.client import LLMClient

logger = get_logger(__name__)

router = APIRouter(prefix="/course-map", tags=["course-map"])


class CourseMapGenerateRequest(BaseModel):
    """Request body for course-map/generate endpoint."""

    topic: str = Field(..., description="Learning topic from onboarding")
    level: Literal["Novice", "Beginner", "Intermediate", "Advanced"] = Field(
        ..., description="User's skill level"
    )
    focus: str = Field(..., description="User's learning focus/goal")
    verified_concept: str = Field(..., description="Concept verified during onboarding")
    mode: Literal["Deep", "Fast", "Light"] = Field(..., description="Learning mode")
    total_commitment_minutes: int = Field(
        ..., ge=30, le=480, description="Total time budget in minutes (30-480)"
    )


class MapMeta(BaseModel):
    """Course map metadata."""

    course_name: str
    strategy_rationale: str
    mode: Literal["Deep", "Fast", "Light"]
    time_budget_minutes: int
    time_sum_minutes: int
    time_delta_minutes: int


class DAGNode(BaseModel):
    """Single node in the DAG."""

    id: int
    title: str
    description: str
    type: Literal["learn", "quiz", "boss"]
    layer: int
    pre_requisites: list[int]
    estimated_minutes: int


class CourseMapGenerateResponse(BaseModel):
    """Response body for course-map/generate endpoint."""

    course_map_id: UUID
    map_meta: MapMeta
    nodes: list[DAGNode]


def get_llm_client() -> LLMClient:
    """Dependency for getting LLM client.

    Returns:
        Configured LLMClient instance.
    """
    return LLMClient(get_settings())


@router.post("/generate", response_model=CourseMapGenerateResponse)
async def generate_course_map(
    request: CourseMapGenerateRequest,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    llm_client: Annotated[LLMClient, Depends(get_llm_client)],
    user_id: UUID | None = Depends(get_optional_user_id),
) -> dict[str, Any]:
    """Generate a course map (DAG) for a learning path.

    This endpoint generates a DAG-structured learning path based on the user's
    profile and preferences. The DAG must have branches and merges, and the
    total time must equal the requested commitment minutes.

    Hard constraints:
    - DAG must have branches and merges (no linear paths)
    - sum(nodes[].estimated_minutes) == total_commitment_minutes
    - mode != Deep => no boss nodes allowed

    Args:
        request: Course map generation request with user profile.
        db: Database session.
        llm_client: LLM client for generating the DAG.
        user_id: Optional authenticated user ID from JWT.

    Returns:
        CourseMapGenerateResponse with course_map_id, map_meta, and nodes.
    """
    service = CourseMapService(llm_client=llm_client, db_session=db)

    result = await service.generate_course_map(
        topic=request.topic,
        level=request.level,
        focus=request.focus,
        verified_concept=request.verified_concept,
        mode=request.mode,
        total_commitment_minutes=request.total_commitment_minutes,
        user_id=user_id,
    )

    # 自动设置新生成的课程为活跃课程
    if user_id:
        try:
            course_map_id = result["course_map_id"]
            await ProfileService.set_active_course_map(
                user_id=user_id,
                course_map_id=course_map_id,
                db=db,
            )
            logger.info(
                "Auto-set new course as active",
                user_id=str(user_id),
                course_map_id=str(course_map_id),
            )
        except Exception as e:
            # 不阻塞主流程，记录错误即可
            logger.warning(
                "Failed to auto-set active course",
                user_id=str(user_id),
                error=str(e),
            )

    return result


# ---------------------------------------------------------------------------
# Retrieval schemas
# ---------------------------------------------------------------------------

class CourseMapListItem(BaseModel):
    """Single course map in the list response."""

    course_map_id: str
    topic: str
    level: str
    mode: str
    map_meta: dict[str, Any]
    nodes: list[dict[str, Any]]
    created_at: str


class CourseMapListResponse(BaseModel):
    """Response for listing user's course maps."""

    courses: list[CourseMapListItem]


class CourseMapDetailResponse(BaseModel):
    """Response for a single course map detail."""

    course_map_id: str
    topic: str
    level: str
    mode: str
    focus: str
    verified_concept: str
    total_commitment_minutes: int
    map_meta: dict[str, Any]
    nodes: list[dict[str, Any]]
    created_at: str


# ---------------------------------------------------------------------------
# Retrieval endpoints
# ---------------------------------------------------------------------------

@router.get("/list", response_model=CourseMapListResponse)
async def list_course_maps(
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict:
    """List all course maps for the authenticated user.

    Returns courses ordered by created_at DESC (newest first).

    Args:
        user_id: Authenticated user ID from JWT.
        db: Database session.

    Returns:
        List of course maps.
    """
    try:
        stmt = (
            select(CourseMap)
            .where(CourseMap.user_id == user_id)
            .order_by(CourseMap.created_at.desc())
        )
        result = await db.execute(stmt)
        rows = result.scalars().all()

        courses = [
            {
                "course_map_id": str(row.id),
                "topic": row.topic,
                "level": row.level,
                "mode": row.mode,
                "map_meta": row.map_meta,
                "nodes": row.nodes,
                "created_at": row.created_at.isoformat(),
            }
            for row in rows
        ]

        logger.info(
            "Listed course maps",
            user_id=str(user_id),
            count=len(courses),
        )

        return {"courses": courses}
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": str(e)},
        )


@router.get("/{course_map_id}", response_model=CourseMapDetailResponse)
async def get_course_map(
    course_map_id: UUID,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict:
    """Get a single course map by ID.

    Only the owner can retrieve the course map.

    Args:
        course_map_id: The course map UUID.
        user_id: Authenticated user ID from JWT.
        db: Database session.

    Returns:
        Full course map details.

    Raises:
        NotFoundError: If course map does not exist or belongs to another user.
    """
    try:
        stmt = select(CourseMap).where(
            CourseMap.id == course_map_id,
            CourseMap.user_id == user_id,
        )
        result = await db.execute(stmt)
        row = result.scalar_one_or_none()

        if row is None:
            raise NotFoundError(resource="CourseMap", identifier=str(course_map_id))

        # 自动更新最后访问记录
        try:
            await ProfileService.update_last_accessed_course(
                user_id=user_id,
                course_map_id=course_map_id,
                db=db,
            )
        except Exception as e:
            # 不阻塞主流程，记录错误即可
            logger.warning(
                "Failed to update last accessed course",
                user_id=str(user_id),
                course_map_id=str(course_map_id),
                error=str(e),
            )

        logger.info(
            "Fetched course map",
            user_id=str(user_id),
            course_map_id=str(course_map_id),
        )

        return {
            "course_map_id": str(row.id),
            "topic": row.topic,
            "level": row.level,
            "mode": row.mode,
            "focus": row.focus,
            "verified_concept": row.verified_concept,
            "total_commitment_minutes": row.total_commitment_minutes,
            "map_meta": row.map_meta,
            "nodes": row.nodes,
            "created_at": row.created_at.isoformat(),
        }
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": str(e)},
        )
