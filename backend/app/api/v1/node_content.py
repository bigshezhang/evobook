"""Node content API endpoints."""

from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.auth import get_optional_user_id
from app.domain.repositories.node_content_repository import NodeContentRepository
from app.domain.services.node_content_service import NodeContentService
from app.infrastructure.database import get_db_session
from app.llm.client import LLMClient
from app.api.routes import NODE_CONTENT_PREFIX

router = APIRouter(prefix=NODE_CONTENT_PREFIX, tags=["node-content"])


# --- Request/Response Models ---

class CourseInfo(BaseModel):
    course_name: str = Field(..., description="Name of the course")
    course_context: str = Field(..., description="Context description for the course")
    topic: str = Field(..., description="Learning topic")
    level: Literal["Novice", "Beginner", "Intermediate", "Advanced"] = Field(..., description="User's skill level")
    mode: Literal["Deep", "Fast", "Light"] = Field(..., description="Learning mode")


class NodeInfo(BaseModel):
    id: int = Field(..., description="Node identifier")
    title: str = Field(..., description="Node title")
    description: str = Field(..., description="Node description")
    type: Literal["learn"] = Field(..., description="Node type")
    estimated_minutes: int = Field(..., ge=1, description="Estimated learning time in minutes")


class KnowledgeCardRequest(BaseModel):
    language: str = Field(default="en", description="Response language (ISO 639-1 code)")
    course: CourseInfo
    node: NodeInfo
    course_map_id: str | None = Field(default=None, description="Optional course map ID for caching")


class KnowledgeCardResponse(BaseModel):
    type: Literal["knowledge_card"]
    node_id: int
    totalPagesInCard: int
    markdown: str
    yaml: str


class ClarificationRequest(BaseModel):
    language: str = Field(..., description="Response language (ISO 639-1 code)")
    user_question_raw: str = Field(..., description="User's raw question text")
    page_markdown: str = Field(..., description="Current page markdown content")
    course_map_id: str | None = Field(default=None, description="Optional course map ID for caching")
    node_id: int | None = Field(default=None, description="Optional node ID for caching")


class ClarificationResponse(BaseModel):
    type: Literal["clarification"]
    corrected_title: str
    short_answer: str


class QADetailRequest(BaseModel):
    language: str = Field(..., description="Response language (ISO 639-1 code)")
    qa_title: str = Field(..., description="Title of the QA")
    qa_short_answer: str = Field(..., description="Short answer to expand upon")
    course_map_id: str | None = Field(default=None, description="Optional course map ID for caching")
    node_id: int | None = Field(default=None, description="Optional node ID for caching")


class ImageSpec(BaseModel):
    placeholder: str
    prompt: str


class QADetailResponse(BaseModel):
    type: Literal["qa_detail"]
    title: str
    body_markdown: str
    image: ImageSpec


# --- Dependencies ---

def get_llm_client() -> LLMClient:
    """Dependency for getting LLM client."""
    return LLMClient(get_settings())


# --- Endpoints ---

@router.post("/knowledge-card", response_model=KnowledgeCardResponse)
async def generate_knowledge_card(
    request: KnowledgeCardRequest,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    llm_client: Annotated[LLMClient, Depends(get_llm_client)],
    user_id: UUID | None = Depends(get_optional_user_id),
) -> dict[str, Any]:
    """Generate a knowledge card for a node."""
    course_map_id = UUID(request.course_map_id) if request.course_map_id else None
    node_content_repo = NodeContentRepository(db)
    service = NodeContentService(llm_client=llm_client, node_content_repo=node_content_repo)

    return await service.generate_knowledge_card(
        language=request.language, course_name=request.course.course_name,
        course_context=request.course.course_context, topic=request.course.topic,
        level=request.course.level, mode=request.course.mode,
        node_id=request.node.id, node_title=request.node.title,
        node_description=request.node.description, node_type=request.node.type,
        estimated_minutes=request.node.estimated_minutes,
        course_map_id=course_map_id, user_id=user_id,
    )


@router.post("/clarification", response_model=ClarificationResponse)
async def generate_clarification(
    request: ClarificationRequest,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    llm_client: Annotated[LLMClient, Depends(get_llm_client)],
    user_id: UUID | None = Depends(get_optional_user_id),
) -> dict[str, Any]:
    """Generate a clarification answer for a user question."""
    course_map_id = UUID(request.course_map_id) if request.course_map_id else None
    node_content_repo = NodeContentRepository(db)
    service = NodeContentService(llm_client=llm_client, node_content_repo=node_content_repo)

    return await service.generate_clarification(
        language=request.language, user_question_raw=request.user_question_raw,
        page_markdown=request.page_markdown, course_map_id=course_map_id,
        node_id=request.node_id, user_id=user_id,
    )


@router.post("/qa-detail", response_model=QADetailResponse)
async def generate_qa_detail(
    request: QADetailRequest,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    llm_client: Annotated[LLMClient, Depends(get_llm_client)],
    user_id: UUID | None = Depends(get_optional_user_id),
) -> dict[str, Any]:
    """Generate a detailed QA explanation with image spec."""
    course_map_id = UUID(request.course_map_id) if request.course_map_id else None
    node_content_repo = NodeContentRepository(db)
    service = NodeContentService(llm_client=llm_client, node_content_repo=node_content_repo)

    return await service.generate_qa_detail(
        language=request.language, qa_title=request.qa_title,
        qa_short_answer=request.qa_short_answer, course_map_id=course_map_id,
        node_id=request.node_id, user_id=user_id,
    )
