"""Node progress API endpoints.

This module provides endpoints for tracking per-node learning progress
within a course map.
"""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.exceptions import AppException
from app.domain.services.node_progress_service import NodeProgressService
from app.infrastructure.database import get_db_session

router = APIRouter(prefix="/node-progress", tags=["node-progress"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class NodeProgressItem(BaseModel):
    """Single node progress entry."""

    node_id: int
    status: str
    updated_at: str


class GetProgressResponse(BaseModel):
    """Response for GET node progress."""

    progress: list[NodeProgressItem]


class UpdateProgressRequest(BaseModel):
    """Request body for single node progress update."""

    status: Literal["locked", "unlocked", "in_progress", "completed"] = Field(
        ..., description="New node status"
    )


class BatchUpdateItem(BaseModel):
    """Single item inside a batch update request."""

    node_id: int = Field(..., description="DAG node ID")
    status: Literal["locked", "unlocked", "in_progress", "completed"] = Field(
        ..., description="New node status"
    )


class BatchUpdateRequest(BaseModel):
    """Request body for batch node progress update."""

    updates: list[BatchUpdateItem] = Field(
        ..., min_length=1, description="List of node progress updates"
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/{course_map_id}", response_model=GetProgressResponse)
async def get_node_progress(
    course_map_id: UUID,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict:
    """Get all node progress for a user's course map.

    Args:
        course_map_id: The course map UUID.
        user_id: Authenticated user ID from JWT.
        db: Database session.

    Returns:
        List of node progress entries.
    """
    try:
        progress = await NodeProgressService.get_progress(
            user_id=user_id,
            course_map_id=course_map_id,
            db=db,
        )
        return {"progress": progress}
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": str(e)},
        )


@router.put("/{course_map_id}/batch", response_model=GetProgressResponse)
async def batch_update_node_progress(
    course_map_id: UUID,
    request: BatchUpdateRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict:
    """Batch update multiple node progresses at once.

    NOTE: This route is registered BEFORE the single-node route
    to avoid FastAPI treating "batch" as a {node_id} path param.

    Args:
        course_map_id: The course map UUID.
        request: Batch update payload.
        user_id: Authenticated user ID from JWT.
        db: Database session.

    Returns:
        List of all updated node progress entries.
    """
    try:
        updates = [item.model_dump() for item in request.updates]
        progress = await NodeProgressService.batch_update(
            user_id=user_id,
            course_map_id=course_map_id,
            updates=updates,
            db=db,
        )
        return {"progress": progress}
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": str(e)},
        )


@router.put("/{course_map_id}/{node_id}", response_model=NodeProgressItem)
async def update_node_progress(
    course_map_id: UUID,
    node_id: int,
    request: UpdateProgressRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict:
    """Update or create progress for a specific node.

    Args:
        course_map_id: The course map UUID.
        node_id: The DAG node ID.
        request: Status update payload.
        user_id: Authenticated user ID from JWT.
        db: Database session.

    Returns:
        Updated node progress entry.
    """
    try:
        result = await NodeProgressService.update_progress(
            user_id=user_id,
            course_map_id=course_map_id,
            node_id=node_id,
            status=request.status,
            db=db,
        )
        return result
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": str(e)},
        )
