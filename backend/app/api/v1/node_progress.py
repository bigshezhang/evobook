"""Node progress API endpoints."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.error_codes import ERROR_INTERNAL
from app.core.exceptions import AppException
from app.domain.repositories.course_map_repository import CourseMapRepository
from app.domain.repositories.learning_activity_repository import LearningActivityRepository
from app.domain.repositories.node_progress_repository import NodeProgressRepository
from app.domain.repositories.user_stats_repository import UserStatsRepository
from app.domain.services.activity_service import ActivityService
from app.domain.services.node_progress_service import NodeProgressService
from app.infrastructure.database import get_db_session
from app.api.routes import NODE_PROGRESS_PREFIX

router = APIRouter(prefix=NODE_PROGRESS_PREFIX, tags=["node-progress"])


class NodeProgressItem(BaseModel):
    node_id: int
    status: str
    updated_at: str


class GetProgressResponse(BaseModel):
    progress: list[NodeProgressItem]


class UpdateProgressRequest(BaseModel):
    status: Literal["locked", "unlocked", "in_progress", "completed"] = Field(..., description="New node status")


class BatchUpdateItem(BaseModel):
    node_id: int = Field(..., description="DAG node ID")
    status: Literal["locked", "unlocked", "in_progress", "completed"] = Field(..., description="New node status")


class BatchUpdateRequest(BaseModel):
    updates: list[BatchUpdateItem] = Field(..., min_length=1, description="List of node progress updates")


@router.get("/{course_map_id}", response_model=GetProgressResponse)
async def get_node_progress(
    course_map_id: UUID,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict:
    """Get all node progress for a user's course map."""
    try:
        node_progress_repo = NodeProgressRepository(db)
        service = NodeProgressService(node_progress_repo=node_progress_repo)
        progress = await service.get_progress(user_id=user_id, course_map_id=course_map_id)
        return {"progress": progress}
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": ERROR_INTERNAL, "message": str(e)})


@router.put("/{course_map_id}/batch", response_model=GetProgressResponse)
async def batch_update_node_progress(
    course_map_id: UUID,
    request: BatchUpdateRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict:
    """Batch update multiple node progresses at once."""
    try:
        node_progress_repo = NodeProgressRepository(db)
        service = NodeProgressService(node_progress_repo=node_progress_repo)
        updates = [item.model_dump() for item in request.updates]
        progress = await service.batch_update(user_id=user_id, course_map_id=course_map_id, updates=updates)

        # Record learning activities for completed nodes
        learning_activity_repo = LearningActivityRepository(db)
        course_map_repo = CourseMapRepository(db)
        user_stats_repo = UserStatsRepository(db)
        activity_service = ActivityService(
            learning_activity_repo=learning_activity_repo,
            course_map_repo=course_map_repo,
            user_stats_repo=user_stats_repo,
        )
        for item in request.updates:
            if item.status == "completed":
                await activity_service.record_activity(
                    user_id=user_id, course_map_id=course_map_id,
                    node_id=item.node_id, activity_type="node_completed",
                )
        await node_progress_repo.commit()

        return {"progress": progress}
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": ERROR_INTERNAL, "message": str(e)})


@router.put("/{course_map_id}/{node_id}", response_model=NodeProgressItem)
async def update_node_progress(
    course_map_id: UUID,
    node_id: int,
    request: UpdateProgressRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict:
    """Update or create progress for a specific node."""
    try:
        node_progress_repo = NodeProgressRepository(db)
        service = NodeProgressService(node_progress_repo=node_progress_repo)
        result = await service.update_progress(
            user_id=user_id, course_map_id=course_map_id, node_id=node_id, status=request.status,
        )

        if request.status == "completed":
            learning_activity_repo = LearningActivityRepository(db)
            course_map_repo = CourseMapRepository(db)
            user_stats_repo = UserStatsRepository(db)
            activity_service = ActivityService(
                learning_activity_repo=learning_activity_repo,
                course_map_repo=course_map_repo,
                user_stats_repo=user_stats_repo,
            )
            await activity_service.record_activity(
                user_id=user_id, course_map_id=course_map_id,
                node_id=node_id, activity_type="node_completed",
            )
            await node_progress_repo.commit()

        return result
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": ERROR_INTERNAL, "message": str(e)})
