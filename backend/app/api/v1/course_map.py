"""Course map API endpoints.

This module provides API endpoints for generating and retrieving course map DAGs.
"""

from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.auth import get_current_user_id, get_optional_user_id
from app.core.error_codes import ERROR_INTERNAL
from app.core.exceptions import AppException, NotFoundError
from app.core.language import get_language
from app.core.logging import get_logger
from app.domain.models.course_map import CourseMap
from app.domain.models.node_progress import NodeProgress
from app.domain.services.content_generation_service import (
    ContentGenerationService,
    initialize_node_contents,
)
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
    type: Literal["learn", "quiz"]
    layer: int
    pre_requisites: list[int]
    estimated_minutes: int
    reward_multiplier: float = Field(..., ge=1.0, le=3.0, description="Reward multiplier (1.0-3.0)")


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
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    llm_client: Annotated[LLMClient, Depends(get_llm_client)],
    user_id: UUID | None = Depends(get_optional_user_id),
    language: str = Depends(get_language),
) -> dict[str, Any]:
    """Generate a course map (DAG) for a learning path.

    This endpoint generates a DAG-structured learning path based on the user's
    profile and preferences. The DAG must have branches and merges, and the
    total time must equal the requested commitment minutes.

    Hard constraints:
    - DAG must have branches and merges (no linear paths)
    - sum(nodes[].estimated_minutes) == total_commitment_minutes

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
        language=language,
    )

    course_map_id = result["course_map_id"]
    nodes = result["nodes"]
    map_meta = result["map_meta"]

    # Initialize node_contents records for all nodes
    try:
        await initialize_node_contents(
            course_map_id=course_map_id,
            nodes=nodes,
            db=db,
        )
        logger.info(
            "Initialized node_contents records",
            course_map_id=str(course_map_id),
            node_count=len(nodes),
        )
    except Exception as e:
        logger.error(
            "Failed to initialize node_contents",
            course_map_id=str(course_map_id),
            error=str(e),
        )
        # Don't fail the request, but log the error

    # Trigger background generation for all learn nodes
    course_context = {
        "topic": request.topic,
        "level": request.level,
        "mode": request.mode,
        "course_name": map_meta.get("course_name", ""),
        "strategy_rationale": map_meta.get("strategy_rationale", ""),
        "language": language,
    }

    # Add background task (creates new DB session internally)
    background_tasks.add_task(
        _background_generate_learn_nodes,
        course_map_id,
        nodes,
        course_context,
        get_settings(),
    )

    logger.info(
        "Triggered background generation for learn nodes",
        course_map_id=str(course_map_id),
        learn_nodes_count=len([n for n in nodes if n.get("type") == "learn"]),
    )

    # 自动设置新生成的课程为活跃课程
    if user_id:
        try:
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
    progress_percentage: float = Field(..., description="Percentage of completed nodes (0-100)")


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
    Includes progress_percentage calculated from node_progress table.

    Args:
        user_id: Authenticated user ID from JWT.
        db: Database session.

    Returns:
        List of course maps with progress percentages.
    """
    try:
        stmt = (
            select(CourseMap)
            .where(CourseMap.user_id == user_id)
            .order_by(CourseMap.created_at.desc())
        )
        result = await db.execute(stmt)
        rows = result.scalars().all()

        courses = []
        for row in rows:
            # 计算进度百分比
            total_nodes = len(row.nodes) if row.nodes else 0

            if total_nodes > 0:
                # 查询已完成的节点数
                progress_stmt = select(func.count(NodeProgress.id)).where(
                    NodeProgress.user_id == user_id,
                    NodeProgress.course_map_id == row.id,
                    NodeProgress.status == "completed",
                )
                progress_result = await db.execute(progress_stmt)
                completed_count = progress_result.scalar() or 0

                progress_percentage = (completed_count / total_nodes) * 100
            else:
                progress_percentage = 0.0

            courses.append({
                "course_map_id": str(row.id),
                "topic": row.topic,
                "level": row.level,
                "mode": row.mode,
                "map_meta": row.map_meta,
                "nodes": row.nodes,
                "created_at": row.created_at.isoformat(),
                "progress_percentage": round(progress_percentage, 1),
            })

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
            detail={"code": ERROR_INTERNAL, "message": str(e)},
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
            detail={"code": ERROR_INTERNAL, "message": str(e)},
        )


# ---------------------------------------------------------------------------
# Progress endpoint
# ---------------------------------------------------------------------------

class NodeGenerationStatus(BaseModel):
    """Generation status for a single node."""

    node_id: int
    type: str
    status: str
    error: str | None = None


class GenerationProgressResponse(BaseModel):
    """Response for generation progress endpoint."""

    course_map_id: str
    overall_status: Literal["initializing", "generating", "completed", "partial_failed"]
    learn_progress: float
    nodes_status: list[NodeGenerationStatus]


@router.get("/{course_map_id}/progress", response_model=GenerationProgressResponse)
async def get_generation_progress(
    course_map_id: UUID,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, Any]:
    """Get generation progress for a course map.

    This endpoint returns the current generation status for all nodes
    in a course map, including overall progress percentage.

    Args:
        course_map_id: Course map UUID.
        user_id: Authenticated user ID from JWT.
        db: Database session.

    Returns:
        Generation progress with node-level status details.

    Raises:
        NotFoundError: If course map does not exist or belongs to another user.
    """
    try:
        # Verify course map ownership
        course_stmt = select(CourseMap).where(
            CourseMap.id == course_map_id,
            CourseMap.user_id == user_id,
        )
        course_result = await db.execute(course_stmt)
        course_map = course_result.scalar_one_or_none()

        if course_map is None:
            raise NotFoundError(resource="CourseMap", identifier=str(course_map_id))

        # Query all node_contents for this course
        from app.domain.models.node_content import NodeContent

        stmt = select(NodeContent).where(
            NodeContent.course_map_id == course_map_id
        )
        result = await db.execute(stmt)
        node_contents = result.scalars().all()

        # Count learn nodes
        total_learn = sum(1 for nc in node_contents if nc.node_type == "learn")
        completed_learn = sum(
            1 for nc in node_contents
            if nc.node_type == "learn" and nc.generation_status == "completed"
        )

        # Calculate progress
        learn_progress = completed_learn / total_learn if total_learn > 0 else 1.0

        # Determine overall status
        statuses = [nc.generation_status for nc in node_contents if nc.node_type == "learn"]
        if not statuses:
            overall_status = "completed"
        elif all(s == "completed" for s in statuses):
            overall_status = "completed"
        elif any(s == "failed" for s in statuses):
            overall_status = "partial_failed"
        elif any(s in ("generating", "pending") for s in statuses):
            overall_status = "generating"
        else:
            overall_status = "initializing"

        # Build node status list
        nodes_status = [
            {
                "node_id": nc.node_id,
                "type": nc.node_type or "unknown",
                "status": nc.generation_status,
                "error": nc.generation_error,
            }
            for nc in node_contents
        ]

        logger.info(
            "Fetched generation progress",
            course_map_id=str(course_map_id),
            overall_status=overall_status,
            learn_progress=learn_progress,
        )

        return {
            "course_map_id": str(course_map_id),
            "overall_status": overall_status,
            "learn_progress": learn_progress,
            "nodes_status": nodes_status,
        }

    except AppException:
        raise
    except Exception as e:
        logger.error(
            "Failed to fetch generation progress",
            course_map_id=str(course_map_id),
            error=str(e),
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail={"code": ERROR_INTERNAL, "message": str(e)},
        )


# ---------------------------------------------------------------------------
# Admin endpoint for manual recovery
# ---------------------------------------------------------------------------

class RecoveryStatsResponse(BaseModel):
    """Response for recovery endpoint."""

    message: str
    stats: dict[str, int]


@router.post("/admin/recover-tasks", response_model=RecoveryStatsResponse)
async def manually_recover_tasks(
    db: Annotated[AsyncSession, Depends(get_db_session)],
    llm_client: Annotated[LLMClient, Depends(get_llm_client)],
) -> dict[str, Any]:
    """Manually trigger recovery of incomplete generation tasks.

    This endpoint can be used to manually restart background generation
    for any courses that have nodes stuck in 'generating' or 'pending' status.

    Useful for:
    - Testing recovery logic
    - Recovering from partial failures
    - Debugging generation issues

    Returns:
        Recovery statistics including courses found and tasks restarted.
    """
    try:
        from app.domain.services.content_generation_service import ContentGenerationService
        from app.domain.services.recovery_service import RecoveryService

        logger.info("Manual recovery triggered")

        # Create services
        content_generation_service = ContentGenerationService(
            llm_client=llm_client,
            db_session=db,
        )
        recovery_service = RecoveryService()

        # Execute recovery
        stats = await recovery_service.recover_incomplete_tasks(
            db=db,
            content_generation_service=content_generation_service,
        )

        logger.info(
            "Manual recovery completed",
            stats=stats,
        )

        return {
            "message": "Recovery completed successfully",
            "stats": stats,
        }

    except Exception as e:
        logger.error(
            "Manual recovery failed",
            error=str(e),
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail={"code": ERROR_INTERNAL, "message": str(e)},
        )


# ---------------------------------------------------------------------------
# Background task helper
# ---------------------------------------------------------------------------

async def _background_generate_learn_nodes(
    course_map_id: UUID,
    nodes: list[dict[str, Any]],
    course_context: dict[str, Any],
    settings: Any,
) -> None:
    """Background task to generate learn node contents.

    This function runs in a background task and creates its own database session.

    Args:
        course_map_id: Course map UUID.
        nodes: List of all nodes from the DAG.
        course_context: Course metadata for generation.
        settings: Application settings.
    """
    from app.infrastructure.database import get_async_session_maker

    logger.info(
        "Background task started for content generation",
        course_map_id=str(course_map_id),
    )

    # Create a new database session for background task
    async_session_maker = get_async_session_maker()
    async with async_session_maker() as db:
        try:
            # Create LLM client and generation service
            llm_client = LLMClient(settings)
            generation_service = ContentGenerationService(
                llm_client=llm_client,
                db_session=db,
            )

            # Generate all learn nodes
            await generation_service.generate_all_learn_nodes(
                course_map_id=course_map_id,
                nodes=nodes,
                course_context=course_context,
            )

            logger.info(
                "Background task completed successfully",
                course_map_id=str(course_map_id),
            )

        except Exception as e:
            logger.error(
                "Background task failed",
                course_map_id=str(course_map_id),
                error=str(e),
                exc_info=True,
            )
