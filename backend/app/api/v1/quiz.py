"""Quiz API endpoints.

This module provides API endpoints for quiz generation.
"""

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.config import get_settings
from app.domain.services.quiz_service import QuizService
from app.llm.client import LLMClient

router = APIRouter(prefix="/quiz", tags=["quiz"])


# --- Request/Response Models ---

class LearnedTopic(BaseModel):
    """A learned topic with its page content."""
    
    topic_name: str = Field(..., description="Name of the learned topic")
    pages_markdown: str = Field(..., description="Markdown content of all pages for this topic")


class QuizGenerateRequest(BaseModel):
    """Request body for quiz/generate endpoint."""
    
    language: Literal["en", "zh"] = Field(..., description="Response language")
    mode: Literal["Deep", "Fast", "Light"] = Field(
        ..., description="Learning mode (affects difficulty)"
    )
    learned_topics: list[LearnedTopic] = Field(
        ..., min_length=1, description="List of learned topics with their content"
    )


class QuizGreeting(BaseModel):
    """Quiz greeting message."""
    
    topics_included: list[str]
    message: str


class QuizQuestion(BaseModel):
    """A single quiz question."""
    
    qtype: Literal["single", "multi", "boolean"]
    prompt: str
    options: list[str] | None = None
    answer: str | None = None
    answers: list[str] | None = None


class QuizGenerateResponse(BaseModel):
    """Response body for quiz/generate endpoint."""
    
    type: Literal["quiz"]
    title: str
    greeting: QuizGreeting
    questions: list[QuizQuestion]


# --- Dependencies ---

def get_llm_client() -> LLMClient:
    """Dependency for getting LLM client.
    
    Returns:
        Configured LLMClient instance.
    """
    return LLMClient(get_settings())


# --- Endpoints ---

@router.post("/generate", response_model=QuizGenerateResponse)
async def generate_quiz(
    request: QuizGenerateRequest,
    llm_client: Annotated[LLMClient, Depends(get_llm_client)],
) -> dict[str, Any]:
    """Generate a quiz from learned topics.
    
    This endpoint generates a quiz (~10 questions) based on the content
    the user has learned. Question difficulty varies by mode:
    
    - Light: mostly recall + simple application
    - Fast: mix recall + application
    - Deep: more reasoning + tricky misconceptions
    
    All questions are generated based on the provided pages_markdown content
    to ensure they are answerable from what the user has learned.
    
    Args:
        request: Quiz generation request with language, mode, and learned topics.
        llm_client: LLM client for generating the quiz.
        
    Returns:
        QuizGenerateResponse with type, title, greeting, questions.
    """
    service = QuizService(llm_client=llm_client)
    
    # Convert pydantic models to dicts for the service
    learned_topics_dicts = [
        {"topic_name": topic.topic_name, "pages_markdown": topic.pages_markdown}
        for topic in request.learned_topics
    ]
    
    result = await service.generate_quiz(
        language=request.language,
        mode=request.mode,
        learned_topics=learned_topics_dicts,
    )
    
    return result
