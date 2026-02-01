"""Course map API endpoints.

This module provides the API endpoint for generating course map DAGs.
"""

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.domain.services.course_map_service import CourseMapService
from app.infrastructure.database import get_db_session
from app.llm.client import LLMClient

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
        
    Returns:
        CourseMapGenerateResponse with map_meta and nodes.
    """
    service = CourseMapService(llm_client=llm_client, db_session=db)
    
    result = await service.generate_course_map(
        topic=request.topic,
        level=request.level,
        focus=request.focus,
        verified_concept=request.verified_concept,
        mode=request.mode,
        total_commitment_minutes=request.total_commitment_minutes,
    )
    
    return result
