"""Onboarding API endpoints.

This module provides the API endpoint for the onboarding conversation flow.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.auth import get_optional_user_id
from app.core.error_codes import ERROR_NOT_FOUND
from app.core.language import get_language
from app.domain.models.discovery_course import DiscoveryCourse
from app.domain.services.onboarding_service import OnboardingService
from app.infrastructure.database import get_db_session
from app.llm.client import LLMClient

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class OnboardingNextRequest(BaseModel):
    """Request body for onboarding/next endpoint."""

    session_id: UUID | None = None
    user_message: str | None = None
    user_choice: str | None = None
    initial_topic: str | None = None  # Pre-selected topic to skip Phase 1
    discovery_preset_id: str | None = None  # Discovery course preset ID for context injection


class ChatResponse(BaseModel):
    """Chat response with message and options."""

    type: str = "chat"
    message: str
    options: list[str]
    session_id: UUID


class FinishData(BaseModel):
    """User profile data from completed onboarding."""

    topic: str
    level: str  # Novice|Beginner|Intermediate|Advanced
    verified_concept: str
    focus: str
    source: str
    mode: str  # Deep|Fast|Light
    intent: str  # add_info|change_topic


class FinishResponse(BaseModel):
    """Finish response with completed user profile."""

    type: str = "finish"
    message: str
    data: FinishData
    session_id: UUID


def get_llm_client() -> LLMClient:
    """Dependency for getting LLM client.

    Returns:
        Configured LLMClient instance.
    """
    return LLMClient(get_settings())


@router.post("/next", response_model=ChatResponse | FinishResponse)
async def onboarding_next(
    request: OnboardingNextRequest,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    llm_client: Annotated[LLMClient, Depends(get_llm_client)],
    user_id: UUID | None = Depends(get_optional_user_id),
    language: str = Depends(get_language),
) -> ChatResponse | FinishResponse:
    """Process onboarding conversation step.

    This endpoint handles the onboarding dialogue flow. It accepts user input
    (either a free-form message or a selected option) and returns the next
    conversation step or the completed user profile.

    Language is automatically resolved from the Accept-Language header.

    If discovery_preset_id is provided, the seed_context from that discovery
    course will be injected into the onboarding flow.

    Args:
        request: Onboarding request with session_id and user input.
        db: Database session.
        llm_client: LLM client for generating responses.
        user_id: Optional authenticated user ID from JWT.
        language: Language code resolved from Accept-Language header.

    Returns:
        ChatResponse with next message/options, or FinishResponse with profile.
    """
    # Resolve discovery preset if provided
    discovery_preset = None
    initial_topic = request.initial_topic

    if request.discovery_preset_id:
        stmt = select(DiscoveryCourse).where(
            DiscoveryCourse.preset_id == request.discovery_preset_id,
            DiscoveryCourse.is_active == True,
        )
        result = await db.execute(stmt)
        course = result.scalar_one_or_none()

        if course is None:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": ERROR_NOT_FOUND,
                    "message": f"Discovery course '{request.discovery_preset_id}' not found",
                },
            )

        discovery_preset = course.seed_context
        # Auto-set initial_topic from discovery preset if not already set
        if not initial_topic and discovery_preset.get("topic"):
            initial_topic = discovery_preset["topic"]

    service = OnboardingService(llm_client=llm_client, db_session=db)

    result = await service.process_next(
        session_id=request.session_id,
        user_message=request.user_message,
        user_choice=request.user_choice,
        initial_topic=initial_topic,
        discovery_preset=discovery_preset,
        user_id=user_id,
        language=language,
    )

    if result["type"] == "finish":
        return FinishResponse(
            type="finish",
            message=result["message"],
            data=FinishData(**result["data"]),
            session_id=result["session_id"],
        )
    else:
        return ChatResponse(
            type="chat",
            message=result["message"],
            options=result["options"],
            session_id=result["session_id"],
        )
