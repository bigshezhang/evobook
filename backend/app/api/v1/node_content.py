"""Node content API endpoints.

This module provides API endpoints for generating node content:
- Knowledge Card
- Clarification
- QA Detail
"""

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.config import get_settings
from app.domain.services.node_content_service import NodeContentService
from app.llm.client import LLMClient

router = APIRouter(prefix="/node-content", tags=["node-content"])


# --- Request/Response Models ---

class CourseInfo(BaseModel):
    """Course information for knowledge card generation."""
    
    course_name: str = Field(..., description="Name of the course")
    course_context: str = Field(..., description="Context description for the course")
    topic: str = Field(..., description="Learning topic")
    level: Literal["Novice", "Beginner", "Intermediate", "Advanced"] = Field(
        ..., description="User's skill level"
    )
    mode: Literal["Deep", "Fast", "Light"] = Field(..., description="Learning mode")


class NodeInfo(BaseModel):
    """Node information for knowledge card generation."""
    
    id: int = Field(..., description="Node identifier")
    title: str = Field(..., description="Node title")
    description: str = Field(..., description="Node description")
    type: Literal["learn", "boss"] = Field(..., description="Node type")
    estimated_minutes: int = Field(..., ge=1, description="Estimated learning time in minutes")


class KnowledgeCardRequest(BaseModel):
    """Request body for knowledge-card endpoint."""
    
    course: CourseInfo
    node: NodeInfo


class KnowledgeCardResponse(BaseModel):
    """Response body for knowledge-card endpoint."""
    
    type: Literal["knowledge_card"]
    node_id: int
    totalPagesInCard: int
    markdown: str
    yaml: str


class ClarificationRequest(BaseModel):
    """Request body for clarification endpoint."""
    
    language: Literal["en", "zh"] = Field(..., description="Response language")
    user_question_raw: str = Field(..., description="User's raw question text")
    page_markdown: str = Field(..., description="Current page markdown content")


class ClarificationResponse(BaseModel):
    """Response body for clarification endpoint."""
    
    type: Literal["clarification"]
    corrected_title: str
    short_answer: str


class QADetailRequest(BaseModel):
    """Request body for qa-detail endpoint."""
    
    language: Literal["en", "zh"] = Field(..., description="Response language")
    qa_title: str = Field(..., description="Title of the QA")
    qa_short_answer: str = Field(..., description="Short answer to expand upon")


class ImageSpec(BaseModel):
    """Image specification for QA detail."""
    
    placeholder: str
    prompt: str


class QADetailResponse(BaseModel):
    """Response body for qa-detail endpoint."""
    
    type: Literal["qa_detail"]
    title: str
    body_markdown: str
    image: ImageSpec


# --- Dependencies ---

def get_llm_client() -> LLMClient:
    """Dependency for getting LLM client.
    
    Returns:
        Configured LLMClient instance.
    """
    return LLMClient(get_settings())


# --- Endpoints ---

@router.post("/knowledge-card", response_model=KnowledgeCardResponse)
async def generate_knowledge_card(
    request: KnowledgeCardRequest,
    llm_client: Annotated[LLMClient, Depends(get_llm_client)],
) -> dict[str, Any]:
    """Generate a knowledge card for a node.
    
    This endpoint generates paginated markdown content for a learning node,
    including Key Elements box, Expert Tip box, and proper page breaks.
    
    The content is tailored to:
    - User's skill level (Novice/Beginner/Intermediate/Advanced)
    - Learning mode (Deep/Fast/Light)
    - Estimated learning time
    
    Args:
        request: Knowledge card generation request with course and node info.
        llm_client: LLM client for generating content.
        
    Returns:
        KnowledgeCardResponse with type, node_id, totalPagesInCard, markdown, yaml.
    """
    service = NodeContentService(llm_client=llm_client)
    
    result = await service.generate_knowledge_card(
        course_name=request.course.course_name,
        course_context=request.course.course_context,
        topic=request.course.topic,
        level=request.course.level,
        mode=request.course.mode,
        node_id=request.node.id,
        node_title=request.node.title,
        node_description=request.node.description,
        node_type=request.node.type,
        estimated_minutes=request.node.estimated_minutes,
    )
    
    return result


@router.post("/clarification", response_model=ClarificationResponse)
async def generate_clarification(
    request: ClarificationRequest,
    llm_client: Annotated[LLMClient, Depends(get_llm_client)],
) -> dict[str, Any]:
    """Generate a clarification answer for a user question.
    
    This endpoint generates a quick, context-aware answer to a user's question
    based on the current page content. The answer is:
    - Limited to 200 Chinese characters or 120 English words
    - Grounded in the provided page context
    - Includes a corrected/improved question title
    
    Args:
        request: Clarification request with user question and page context.
        llm_client: LLM client for generating content.
        
    Returns:
        ClarificationResponse with type, corrected_title, short_answer.
    """
    service = NodeContentService(llm_client=llm_client)
    
    result = await service.generate_clarification(
        language=request.language,
        user_question_raw=request.user_question_raw,
        page_markdown=request.page_markdown,
    )
    
    return result


@router.post("/qa-detail", response_model=QADetailResponse)
async def generate_qa_detail(
    request: QADetailRequest,
    llm_client: Annotated[LLMClient, Depends(get_llm_client)],
) -> dict[str, Any]:
    """Generate a detailed QA explanation with image spec.
    
    This endpoint expands a short QA answer into a structured deep explanation
    with an accompanying image specification for educational diagrams.
    
    Args:
        request: QA detail request with title and short answer.
        llm_client: LLM client for generating content.
        
    Returns:
        QADetailResponse with type, title, body_markdown, image.
    """
    service = NodeContentService(llm_client=llm_client)
    
    result = await service.generate_qa_detail(
        language=request.language,
        qa_title=request.qa_title,
        qa_short_answer=request.qa_short_answer,
    )
    
    return result
