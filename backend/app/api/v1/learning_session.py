"""Learning session API endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.error_codes import ERROR_INTERNAL, ERROR_INVALID_UUID
from app.core.exceptions import AppException
from app.domain.repositories.course_map_repository import CourseMapRepository
from app.domain.repositories.learning_activity_repository import LearningActivityRepository
from app.domain.repositories.user_stats_repository import UserStatsRepository
from app.domain.services.learning_session_service import LearningSessionService
from app.infrastructure.database import get_db_session
from app.api.routes import LEARNING_PREFIX

router = APIRouter(prefix=LEARNING_PREFIX, tags=["learning"])


class HeartbeatRequest(BaseModel):
    course_map_id: str = Field(..., description="Course UUID")
    node_id: int = Field(..., description="Node ID")
    client_timestamp: str | None = Field(default=None, description="Client timestamp (ISO 8601), optional")


class HeartbeatResponse(BaseModel):
    acknowledged: bool = Field(..., description="Whether heartbeat was accepted")
    total_study_seconds: int = Field(..., description="User total study time (seconds)")
    reason: str | None = Field(default=None, description="Reason if acknowledged=False")


@router.post("/heartbeat", response_model=HeartbeatResponse)
async def record_heartbeat(
    request: HeartbeatRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict:
    """Receive a learning heartbeat."""
    try:
        course_map_id = UUID(request.course_map_id)
    except ValueError:
        raise HTTPException(status_code=400, detail={"code": ERROR_INVALID_UUID, "message": "Invalid course_map_id format"})

    try:
        course_map_repo = CourseMapRepository(db)
        learning_activity_repo = LearningActivityRepository(db)
        user_stats_repo = UserStatsRepository(db)
        service = LearningSessionService(
            course_map_repo=course_map_repo,
            learning_activity_repo=learning_activity_repo,
            user_stats_repo=user_stats_repo,
        )
        return await service.process_heartbeat(
            user_id=user_id, course_map_id=course_map_id, node_id=request.node_id,
        )
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": ERROR_INTERNAL, "message": str(e)})
