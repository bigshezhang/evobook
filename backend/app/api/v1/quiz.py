"""Quiz API endpoints.

This module provides API endpoints for quiz generation.
"""

from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.core.auth import get_optional_user_id, get_current_user_id
from app.core.logging import get_logger
from app.domain.models.quiz_attempt import QuizAttempt
from app.domain.repositories.course_map_repository import CourseMapRepository
from app.domain.repositories.quiz_attempt_repository import QuizAttemptRepository
from app.domain.services.quiz_service import QuizService
from app.infrastructure.database import get_async_session_maker, get_db_session
from app.llm.client import LLMClient
from app.api.routes import QUIZ_PREFIX

router = APIRouter(prefix=QUIZ_PREFIX, tags=["quiz"])
logger = get_logger(__name__)


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
    """Quiz greeting message (deprecated, kept for backward compatibility)."""

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
    greeting: QuizGreeting | None = None
    questions: list[QuizQuestion]


class QuizDraftSaveRequest(BaseModel):
    """Request body for quiz/draft save endpoint."""

    course_map_id: UUID = Field(..., description="Course map ID")
    node_id: int = Field(..., description="Quiz node ID")
    quiz_json: dict[str, Any] = Field(
        ...,
        description="Quiz data: questions and user_answers (draft, score not required)",
    )


class QuizDraftSaveResponse(BaseModel):
    """Response body for quiz/draft save endpoint."""

    attempt_id: UUID = Field(..., description="Draft attempt ID (create or update)")
    created_at: datetime = Field(..., description="Creation or update timestamp")


class QuizSubmitRequest(BaseModel):
    """Request body for quiz/submit endpoint."""

    course_map_id: UUID = Field(..., description="Course map ID")
    node_id: int = Field(..., description="Quiz node ID")
    quiz_json: dict[str, Any] = Field(..., description="Quiz data including questions and user answers")
    score: int = Field(..., ge=0, le=100, description="Quiz score (0-100)")
    attempt_id: UUID | None = Field(
        default=None,
        description="If provided and is a draft, update it with score instead of creating new",
    )


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
        QuizGenerateResponse with type, title, questions.
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


@router.put("/draft", response_model=QuizDraftSaveResponse)
async def save_quiz_draft(
    request: QuizDraftSaveRequest,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    llm_client: Annotated[LLMClient, Depends(get_llm_client)],
    user_id: UUID = Depends(get_current_user_id),
) -> QuizDraftSaveResponse:
    """Save or update quiz draft (questions and user answers, without score).

    Used to persist in-progress quiz so user can resume after leaving.
    If a draft already exists for this user+course+node, it is updated.
    Otherwise a new draft is created.

    If missing answers are detected in the questions, a background task
    is started to fill them in asynchronously.
    """
    quiz_repo = QuizAttemptRepository(db)
    draft = await quiz_repo.find_draft_by_user_course_node(
        user_id=user_id,
        course_map_id=request.course_map_id,
        node_id=request.node_id,
    )

    # Save or update draft
    if draft:
        draft.quiz_json = request.quiz_json
        await quiz_repo.commit()
        await quiz_repo.refresh(draft)
        attempt_id = draft.id
        created_at = draft.created_at
    else:
        attempt = QuizAttempt(
            user_id=user_id,
            course_map_id=request.course_map_id,
            node_id=request.node_id,
            quiz_json=request.quiz_json,
            score=None,
        )
        await quiz_repo.create(attempt)
        await quiz_repo.commit()
        await quiz_repo.refresh(attempt)
        attempt_id = attempt.id
        created_at = attempt.created_at

    # Check if questions have missing answers
    questions = request.quiz_json.get("questions", [])
    if questions:
        quiz_service = QuizService(llm_client)
        missing_issues = quiz_service._check_missing_answers(questions)
        
        if missing_issues:
            # Start background task to fill missing answers
            logger.info(
                "Starting background task to fill missing answers",
                attempt_id=str(attempt_id),
                missing_count=len(missing_issues),
            )
            
            background_tasks.add_task(
                _fill_quiz_answers_background,
                attempt_id=attempt_id,
                course_map_id=request.course_map_id,
                quiz_json=request.quiz_json,
                settings=get_settings(),
            )

    return QuizDraftSaveResponse(
        attempt_id=attempt_id,
        created_at=created_at,
    )


@router.get("/draft", response_model=QuizAttemptDetail)
async def get_quiz_draft(
    course_map_id: UUID,
    node_id: int,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    user_id: UUID = Depends(get_current_user_id),
) -> QuizAttemptDetail:
    """Get in-progress quiz draft for a node, if any."""
    quiz_repo = QuizAttemptRepository(db)
    draft = await quiz_repo.find_draft_by_user_course_node(
        user_id=user_id,
        course_map_id=course_map_id,
        node_id=node_id,
    )
    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz draft not found",
        )
    return QuizAttemptDetail(
        id=draft.id,
        course_map_id=draft.course_map_id,
        node_id=draft.node_id,
        quiz_json=draft.quiz_json,
        score=draft.score,
        created_at=draft.created_at,
    )


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
    quiz_repo = QuizAttemptRepository(db)

    if request.attempt_id:
        existing = await quiz_repo.find_by_id_and_user(request.attempt_id, user_id)
        if existing:
            # If already submitted (score is not None), return existing attempt
            # This prevents duplicate submissions
            if existing.score is not None:
                logger.warning(
                    "Duplicate quiz submission blocked",
                    attempt_id=request.attempt_id,
                    user_id=str(user_id),
                    existing_score=existing.score,
                )
                return QuizSubmitResponse(
                    attempt_id=existing.id,
                    created_at=existing.created_at,
                )
            
            # If it's a draft (score is None), update it
            if existing.score is None:
                existing.quiz_json = request.quiz_json
                existing.score = request.score
                await quiz_repo.commit()
                await quiz_repo.refresh(existing)
                logger.info(
                    "Quiz draft updated with submission",
                    attempt_id=existing.id,
                    score=request.score,
                )
                return QuizSubmitResponse(
                    attempt_id=existing.id,
                    created_at=existing.created_at,
                )

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
    # Query completed attempts only (exclude drafts where score is null)
    quiz_repo = QuizAttemptRepository(db)
    attempts = await quiz_repo.find_by_user_course_node(
        user_id, course_map_id, node_id, exclude_drafts=True
    )

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


# --- Background Tasks ---

async def _fill_quiz_answers_background(
    attempt_id: UUID,
    course_map_id: UUID,
    quiz_json: dict[str, Any],
    settings: Settings,
) -> None:
    """Background task to fill missing answers in a quiz draft.

    This task runs asynchronously after the draft is saved, so the user
    gets immediate response while answers are being filled in the background.

    Args:
        attempt_id: The draft attempt ID to update.
        course_map_id: Course map ID to get language settings.
        quiz_json: The quiz JSON data with questions.
        settings: Application settings for database and LLM.
    """
    logger.info(
        "Background task started: filling quiz answers",
        attempt_id=str(attempt_id),
    )

    try:
        # Create new database session for background task
        session_maker = get_async_session_maker(settings.database_url)
        
        async with session_maker() as db:
            # Get language from course map
            course_map_repo = CourseMapRepository(db)
            course_map = await course_map_repo.get_by_id(course_map_id)
            
            if not course_map:
                logger.error(
                    "Course map not found for quiz draft",
                    attempt_id=str(attempt_id),
                    course_map_id=str(course_map_id),
                )
                return
            
            language = course_map.language or "en"
            
            # Create LLM client and quiz service
            llm_client = LLMClient(settings)
            quiz_service = QuizService(llm_client)

            # Get the questions
            questions = quiz_json.get("questions", [])
            if not questions:
                logger.warning(
                    "No questions found in quiz_json",
                    attempt_id=str(attempt_id),
                )
                return

            # Fill missing answers
            try:
                updated_questions = await quiz_service.fill_missing_answers(
                    questions=questions,
                    language=language,
                )

                # Update the draft in database
                quiz_repo = QuizAttemptRepository(db)
                draft = await quiz_repo.get_by_id(attempt_id)
                
                if not draft:
                    logger.error(
                        "Draft not found when trying to update answers",
                        attempt_id=str(attempt_id),
                    )
                    return

                # Update quiz_json with filled answers
                updated_quiz_json = draft.quiz_json.copy()
                updated_quiz_json["questions"] = updated_questions
                draft.quiz_json = updated_quiz_json

                await quiz_repo.commit()
                await quiz_repo.refresh(draft)

                logger.info(
                    "Successfully filled quiz answers in background",
                    attempt_id=str(attempt_id),
                )

            except Exception as e:
                logger.error(
                    "Failed to fill quiz answers",
                    attempt_id=str(attempt_id),
                    error=str(e),
                    exc_info=True,
                )
                # Don't raise - background task should not crash

    except Exception as e:
        logger.error(
            "Background task failed: filling quiz answers",
            attempt_id=str(attempt_id),
            error=str(e),
            exc_info=True,
        )
