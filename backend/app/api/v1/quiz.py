"""Quiz API endpoints.

This module provides API endpoints for quiz generation.
"""

from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.auth import get_optional_user_id, get_current_user_id
from app.domain.models.quiz_attempt import QuizAttempt
from app.domain.repositories.quiz_attempt_repository import QuizAttemptRepository
from app.domain.services.quiz_service import QuizService
from app.infrastructure.database import get_db_session
from app.llm.client import LLMClient
from app.api.routes import QUIZ_PREFIX

router = APIRouter(prefix=QUIZ_PREFIX, tags=["quiz"])


# --- Request/Response Models ---

class LearnedTopic(BaseModel):
    """A learned topic with its page content."""

    topic_name: str = Field(..., description="Name of the learned topic")
    pages_markdown: str = Field(..., description="Markdown content of all pages for this topic")


class QuizGenerateRequest(BaseModel):
    """Request body for quiz/generate endpoint."""

    language: str = Field(..., description="Response language (ISO 639-1 code)")
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


class QuizSubmitRequest(BaseModel):
    """Request body for quiz/submit endpoint."""

    course_map_id: UUID = Field(..., description="Course map ID")
    node_id: int = Field(..., description="Quiz node ID")
    quiz_json: dict[str, Any] = Field(..., description="Quiz data including questions and user answers")
    score: int = Field(..., ge=0, le=100, description="Quiz score (0-100)")


class QuizSubmitResponse(BaseModel):
    """Response body for quiz/submit endpoint."""

    attempt_id: UUID = Field(..., description="Created attempt ID")
    created_at: datetime = Field(..., description="Attempt creation timestamp")


class QuizAttemptSummary(BaseModel):
    """Summary of a quiz attempt for history list."""

    id: UUID
    node_id: int
    score: int | None
    total_questions: int
    created_at: datetime


class QuizHistoryResponse(BaseModel):
    """Response body for quiz/history endpoint."""

    attempts: list[QuizAttemptSummary]


class QuizAttemptDetail(BaseModel):
    """Full detail of a quiz attempt."""

    id: UUID
    course_map_id: UUID
    node_id: int
    quiz_json: dict[str, Any]
    score: int | None
    created_at: datetime


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
    user_id: UUID | None = Depends(get_optional_user_id),
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
        user_id: Optional authenticated user ID from JWT.

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
        user_id=user_id,
    )

    return result


@router.post("/submit", response_model=QuizSubmitResponse, status_code=status.HTTP_201_CREATED)
async def submit_quiz(
    request: QuizSubmitRequest,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    user_id: UUID = Depends(get_current_user_id),
) -> QuizSubmitResponse:
    """Submit a quiz attempt and save results.

    This endpoint records a quiz attempt with the user's answers and score.
    All attempts are saved for history tracking.

    Args:
        request: Quiz submission data including course_map_id, node_id, quiz_json, score.
        db: Database session.
        user_id: Authenticated user ID from JWT.

    Returns:
        QuizSubmitResponse with attempt_id and created_at.

    Raises:
        HTTPException: 401 if user is not authenticated.
    """
    # Create quiz attempt record
    quiz_repo = QuizAttemptRepository(db)
    attempt = QuizAttempt(
        user_id=user_id,
        course_map_id=request.course_map_id,
        node_id=request.node_id,
        quiz_json=request.quiz_json,
        score=request.score,
    )

    await quiz_repo.create(attempt)
    await quiz_repo.commit()
    await quiz_repo.refresh(attempt)

    return QuizSubmitResponse(
        attempt_id=attempt.id,
        created_at=attempt.created_at,
    )


@router.get("/history", response_model=QuizHistoryResponse)
async def get_quiz_history(
    course_map_id: UUID,
    node_id: int,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    user_id: UUID = Depends(get_current_user_id),
) -> QuizHistoryResponse:
    """Get quiz attempt history for a specific node.

    Returns all quiz attempts for the given course map and node,
    ordered by creation time (newest first).

    Args:
        course_map_id: Course map ID to filter by.
        node_id: Quiz node ID to filter by.
        db: Database session.
        user_id: Authenticated user ID from JWT.

    Returns:
        QuizHistoryResponse with list of attempt summaries.

    Raises:
        HTTPException: 401 if user is not authenticated.
    """
    # Query attempts for this user, course_map, and node
    quiz_repo = QuizAttemptRepository(db)
    attempts = await quiz_repo.find_by_user_course_node(user_id, course_map_id, node_id)

    # Build summary list
    summaries = [
        QuizAttemptSummary(
            id=attempt.id,
            node_id=attempt.node_id,
            score=attempt.score,
            total_questions=len(attempt.quiz_json.get("questions", [])),
            created_at=attempt.created_at,
        )
        for attempt in attempts
    ]

    return QuizHistoryResponse(attempts=summaries)


@router.get("/attempt/{attempt_id}", response_model=QuizAttemptDetail)
async def get_quiz_attempt_detail(
    attempt_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    user_id: UUID = Depends(get_current_user_id),
) -> QuizAttemptDetail:
    """Get full details of a quiz attempt.

    Returns the complete quiz attempt including all questions and user answers.

    Args:
        attempt_id: Quiz attempt ID.
        db: Database session.
        user_id: Authenticated user ID from JWT.

    Returns:
        QuizAttemptDetail with full attempt data.

    Raises:
        HTTPException: 401 if user is not authenticated.
        HTTPException: 404 if attempt not found or not owned by user.
    """
    # Query the attempt
    quiz_repo = QuizAttemptRepository(db)
    attempt = await quiz_repo.find_by_id_and_user(attempt_id, user_id)

    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz attempt not found",
        )

    return QuizAttemptDetail(
        id=attempt.id,
        course_map_id=attempt.course_map_id,
        node_id=attempt.node_id,
        quiz_json=attempt.quiz_json,
        score=attempt.score,
        created_at=attempt.created_at,
    )
