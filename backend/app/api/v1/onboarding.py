"""Onboarding API endpoints.

This module provides the API endpoint for the onboarding conversation flow.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
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
    intent: str  # add_info|change_topic


class FinishResponse(BaseModel):
    """Finish response with completed user profile."""

    type: str = "finish"
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
) -> ChatResponse | FinishResponse:
    """Process onboarding conversation step.

    This endpoint handles the onboarding dialogue flow. It accepts user input
    (either a free-form message or a selected option) and returns the next
    conversation step or the completed user profile.

    Args:
        request: Onboarding request with session_id and user input.
        db: Database session.
        llm_client: LLM client for generating responses.

    Returns:
        ChatResponse with next message/options, or FinishResponse with profile.
    """
    service = OnboardingService(llm_client=llm_client, db_session=db)

    result = await service.process_next(
        session_id=request.session_id,
        user_message=request.user_message,
        user_choice=request.user_choice,
        initial_topic=request.initial_topic,
    )

    if result["type"] == "finish":
        return FinishResponse(
            type="finish",
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
