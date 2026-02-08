"""Course map API endpoints.

This module provides API endpoints for generating and retrieving course map DAGs.
"""

from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.auth import get_current_user_id, get_optional_user_id
from app.core.error_codes import ERROR_INTERNAL
from app.core.exceptions import AppException, NotFoundError
from app.core.language import get_language
from app.core.logging import get_logger
from app.domain.repositories.course_map_repository import CourseMapRepository
from app.domain.repositories.node_content_repository import NodeContentRepository
from app.domain.repositories.profile_repository import ProfileRepository
from app.domain.services.content_generation_service import (
    ContentGenerationService,
    initialize_node_contents,
)
from app.domain.services.course_map_service import CourseMapService
from app.domain.services.profile_service import ProfileService
from app.infrastructure.database import get_db_session
from app.llm.client import LLMClient
from app.api.routes import COURSE_MAP_PREFIX

logger = get_logger(__name__)

router = APIRouter(prefix=COURSE_MAP_PREFIX, tags=["course-map"])


class CourseMapGenerateRequest(BaseModel):
    """Request body for course-map/generate endpoint."""
    topic: str = Field(..., description="Learning topic from onboarding")
    level: Literal["Novice", "Beginner", "Intermediate", "Advanced"] = Field(..., description="User's skill level")
    focus: str = Field(..., description="User's learning focus/goal")
    verified_concept: str = Field(..., description="Concept verified during onboarding")
    mode: Literal["Deep", "Fast", "Light"] = Field(..., description="Learning mode")
    total_commitment_minutes: int = Field(..., ge=30, le=480, description="Total time budget in minutes (30-480)")


class MapMeta(BaseModel):
    course_name: str
    strategy_rationale: str
    mode: Literal["Deep", "Fast", "Light"]
    time_budget_minutes: int
    time_sum_minutes: int
    time_delta_minutes: int


class DAGNode(BaseModel):
    id: int
    title: str
    description: str
    type: Literal["learn", "quiz"]
    layer: int
    pre_requisites: list[int]
    estimated_minutes: int
    reward_multiplier: float = Field(..., ge=1.0, le=3.0, description="Reward multiplier (1.0-3.0)")


class CourseMapGenerateResponse(BaseModel):
    course_map_id: UUID
    map_meta: MapMeta
    nodes: list[DAGNode]


def get_llm_client() -> LLMClient:
    """Dependency for getting LLM client."""
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
    """Generate a course map (DAG) for a learning path."""
    course_map_repo = CourseMapRepository(db)
    node_content_repo = NodeContentRepository(db)
    profile_repo = ProfileRepository(db)

    service = CourseMapService(llm_client=llm_client, course_map_repo=course_map_repo)

    result = await service.generate_course_map(
        topic=request.topic, level=request.level, focus=request.focus,
        verified_concept=request.verified_concept, mode=request.mode,
        total_commitment_minutes=request.total_commitment_minutes,
        user_id=user_id, language=language,
    )

    course_map_id = result["course_map_id"]
    nodes = result["nodes"]
    map_meta = result["map_meta"]

    # Initialize node_contents records
    try:
        await initialize_node_contents(
            course_map_id=course_map_id, nodes=nodes, node_content_repo=node_content_repo,
        )
        logger.info("Initialized node_contents records", course_map_id=str(course_map_id), node_count=len(nodes))
    except Exception as e:
        logger.error("Failed to initialize node_contents", course_map_id=str(course_map_id), error=str(e))

    # Trigger background generation
    course_context = {
        "topic": request.topic, "level": request.level, "mode": request.mode,
        "course_name": map_meta.get("course_name", ""),
        "strategy_rationale": map_meta.get("strategy_rationale", ""),
        "language": language,
    }
    background_tasks.add_task(
        _background_generate_learn_nodes, course_map_id, nodes, course_context, get_settings(),
    )

    logger.info("Triggered background generation for learn nodes", course_map_id=str(course_map_id), learn_nodes_count=len([n for n in nodes if n.get("type") == "learn"]))

    # Auto-set new course as active
    if user_id:
        try:
            profile_service = ProfileService(profile_repo=profile_repo)
            await profile_service.set_active_course_map(user_id=user_id, course_map_id=course_map_id)
            logger.info("Auto-set new course as active", user_id=str(user_id), course_map_id=str(course_map_id))
        except Exception as e:
            logger.warning("Failed to auto-set active course", user_id=str(user_id), error=str(e))

    return result


# ---------------------------------------------------------------------------
# Retrieval schemas
# ---------------------------------------------------------------------------

class CourseMapListItem(BaseModel):
    course_map_id: str
    topic: str
    level: str
    mode: str
    map_meta: dict[str, Any]
    nodes: list[dict[str, Any]]
    created_at: str
    progress_percentage: float = Field(..., description="Percentage of completed nodes (0-100)")


class CourseMapListResponse(BaseModel):
    courses: list[CourseMapListItem]


class CourseMapDetailResponse(BaseModel):
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
    """List all course maps for the authenticated user."""
    try:
        course_map_repo = CourseMapRepository(db)
        rows = await course_map_repo.find_by_user(user_id)

        courses = []
        for row in rows:
            total_nodes = len(row.nodes) if row.nodes else 0
            if total_nodes > 0:
                completed_count = await course_map_repo.count_completed_nodes(user_id, row.id)
                progress_percentage = (completed_count / total_nodes) * 100
            else:
                progress_percentage = 0.0

            courses.append({
                "course_map_id": str(row.id), "topic": row.topic, "level": row.level,
                "mode": row.mode, "map_meta": row.map_meta, "nodes": row.nodes,
                "created_at": row.created_at.isoformat(), "progress_percentage": round(progress_percentage, 1),
            })

        logger.info("Listed course maps", user_id=str(user_id), count=len(courses))
        return {"courses": courses}
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": ERROR_INTERNAL, "message": str(e)})


@router.get("/{course_map_id}", response_model=CourseMapDetailResponse)
async def get_course_map(
    course_map_id: UUID,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict:
    """Get a single course map by ID."""
    try:
        course_map_repo = CourseMapRepository(db)
        row = await course_map_repo.find_by_id_and_user(course_map_id, user_id)

        if row is None:
            raise NotFoundError(resource="CourseMap", identifier=str(course_map_id))

        # Auto-update last accessed
        try:
            profile_repo = ProfileRepository(db)
            profile_service = ProfileService(profile_repo=profile_repo)
            await profile_service.update_last_accessed_course(user_id=user_id, course_map_id=course_map_id)
        except Exception as e:
            logger.warning("Failed to update last accessed course", user_id=str(user_id), course_map_id=str(course_map_id), error=str(e))

        logger.info("Fetched course map", user_id=str(user_id), course_map_id=str(course_map_id))

        return {
            "course_map_id": str(row.id), "topic": row.topic, "level": row.level,
            "mode": row.mode, "focus": row.focus, "verified_concept": row.verified_concept,
            "total_commitment_minutes": row.total_commitment_minutes, "map_meta": row.map_meta,
            "nodes": row.nodes, "created_at": row.created_at.isoformat(),
        }
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": ERROR_INTERNAL, "message": str(e)})


# ---------------------------------------------------------------------------
# Progress endpoint
# ---------------------------------------------------------------------------

class NodeGenerationStatus(BaseModel):
    node_id: int
    type: str
    status: str
    error: str | None = None


class GenerationProgressResponse(BaseModel):
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
    """Get generation progress for a course map."""
    try:
        course_map_repo = CourseMapRepository(db)
        course_map = await course_map_repo.find_by_id_and_user(course_map_id, user_id)
        if course_map is None:
            raise NotFoundError(resource="CourseMap", identifier=str(course_map_id))

        node_content_repo = NodeContentRepository(db)
        node_contents = await node_content_repo.find_by_course_map(course_map_id)

        total_learn = sum(1 for nc in node_contents if nc.node_type == "learn")
        completed_learn = sum(1 for nc in node_contents if nc.node_type == "learn" and nc.generation_status == "completed")
        learn_progress = completed_learn / total_learn if total_learn > 0 else 1.0

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

        nodes_status = [
            {"node_id": nc.node_id, "type": nc.node_type or "unknown", "status": nc.generation_status, "error": nc.generation_error}
            for nc in node_contents
        ]

        logger.info("Fetched generation progress", course_map_id=str(course_map_id), overall_status=overall_status, learn_progress=learn_progress)
        return {"course_map_id": str(course_map_id), "overall_status": overall_status, "learn_progress": learn_progress, "nodes_status": nodes_status}

    except AppException:
        raise
    except Exception as e:
        logger.error("Failed to fetch generation progress", course_map_id=str(course_map_id), error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail={"code": ERROR_INTERNAL, "message": str(e)})


# ---------------------------------------------------------------------------
# Admin endpoint for manual recovery
# ---------------------------------------------------------------------------

class RecoveryStatsResponse(BaseModel):
    message: str
    stats: dict[str, int]


@router.post("/admin/recover-tasks", response_model=RecoveryStatsResponse)
async def manually_recover_tasks(
    db: Annotated[AsyncSession, Depends(get_db_session)],
    llm_client: Annotated[LLMClient, Depends(get_llm_client)],
) -> dict[str, Any]:
    """Manually trigger recovery of incomplete generation tasks."""
    try:
        from app.domain.services.recovery_service import RecoveryService

        logger.info("Manual recovery triggered")

        node_content_repo = NodeContentRepository(db)
        course_map_repo = CourseMapRepository(db)
        content_generation_service = ContentGenerationService(
            llm_client=llm_client, node_content_repo=node_content_repo,
        )
        recovery_service = RecoveryService(
            node_content_repo=node_content_repo, course_map_repo=course_map_repo,
        )

        stats = await recovery_service.recover_incomplete_tasks(
            content_generation_service=content_generation_service,
        )

        logger.info("Manual recovery completed", stats=stats)
        return {"message": "Recovery completed successfully", "stats": stats}

    except Exception as e:
        logger.error("Manual recovery failed", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail={"code": ERROR_INTERNAL, "message": str(e)})


# ---------------------------------------------------------------------------
# Background task helper
# ---------------------------------------------------------------------------

async def _background_generate_learn_nodes(
    course_map_id: UUID,
    nodes: list[dict[str, Any]],
    course_context: dict[str, Any],
    settings: Any,
) -> None:
    """Background task to generate learn node contents."""
    from app.infrastructure.database import get_async_session_maker

    logger.info("Background task started for content generation", course_map_id=str(course_map_id))

    async_session_maker = get_async_session_maker()
    async with async_session_maker() as db:
        try:
            llm_client = LLMClient(settings)
            node_content_repo = NodeContentRepository(db)
            generation_service = ContentGenerationService(
                llm_client=llm_client, node_content_repo=node_content_repo,
            )
            await generation_service.generate_all_learn_nodes(
                course_map_id=course_map_id, nodes=nodes, course_context=course_context,
            )
            logger.info("Background task completed successfully", course_map_id=str(course_map_id))
        except Exception as e:
            logger.error("Background task failed", course_map_id=str(course_map_id), error=str(e), exc_info=True)
