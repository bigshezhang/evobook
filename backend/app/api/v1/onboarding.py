"""Onboarding API endpoints.

This module provides the API endpoint for the onboarding conversation flow.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.auth import get_optional_user_id
from app.core.error_codes import ERROR_NOT_FOUND
from app.core.language import get_language
from app.domain.repositories.discovery_course_repository import DiscoveryCourseRepository
from app.domain.repositories.onboarding_repository import OnboardingRepository
from app.domain.repositories.profile_repository import ProfileRepository
from app.domain.services.onboarding_service import OnboardingService
from app.infrastructure.database import get_db_session
from app.llm.client import LLMClient
from app.api.routes import ONBOARDING_PREFIX

router = APIRouter(prefix=ONBOARDING_PREFIX, tags=["onboarding"])


class OnboardingNextRequest(BaseModel):
    """Request body for onboarding/next endpoint."""

    session_id: UUID | None = None
    user_message: str | None = None
    user_choice: str | None = None
    initial_topic: str | None = None
    discovery_preset_id: str | None = None


class ChatResponse(BaseModel):
    """Chat response with message and options."""

    type: str = "chat"
    message: str
    options: list[str]
    session_id: UUID


class FinishData(BaseModel):
    """User profile data from completed onboarding."""

    topic: str
    level: str
    verified_concept: str
    focus: str
    source: str
    mode: str
    intent: str


class FinishResponse(BaseModel):
    """Finish response with completed user profile."""

    type: str = "finish"
    message: str
    data: FinishData
    session_id: UUID


class ConceptListCheckResponse(BaseModel):
    """Response asking user to select known concepts."""

    type: str = "concept_list_check"
    message: str
    concepts: list[str]
    session_id: UUID


def get_llm_client() -> LLMClient:
    """Dependency for getting LLM client."""
    return LLMClient(get_settings())


@router.post("/next", response_model=ChatResponse | FinishResponse | ConceptListCheckResponse)
async def onboarding_next(
    request: OnboardingNextRequest,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    llm_client: Annotated[LLMClient, Depends(get_llm_client)],
    user_id: UUID | None = Depends(get_optional_user_id),
    language: str = Depends(get_language),
) -> ChatResponse | FinishResponse | ConceptListCheckResponse:
    """Process onboarding conversation step."""
    # Resolve discovery preset if provided
    discovery_preset = None
    initial_topic = request.initial_topic

    if request.discovery_preset_id:
        discovery_course_repo = DiscoveryCourseRepository(db)
        course = await discovery_course_repo.find_active_by_preset_id(
            request.discovery_preset_id
        )

        if course is None:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": ERROR_NOT_FOUND,
                    "message": f"Discovery course '{request.discovery_preset_id}' not found",
                },
            )

        discovery_preset = course.seed_context
        if not initial_topic and discovery_preset.get("topic"):
            initial_topic = discovery_preset["topic"]

    onboarding_repo = OnboardingRepository(db)
    profile_repo = ProfileRepository(db)
    service = OnboardingService(
        llm_client=llm_client,
        onboarding_repo=onboarding_repo,
        profile_repo=profile_repo,
    )

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
    elif result["type"] == "concept_list_check":
        return ConceptListCheckResponse(
            type="concept_list_check",
            message=result["message"],
            concepts=result["concepts"],
            session_id=result["session_id"],
        )
    else:
        return ChatResponse(
            type="chat",
            message=result["message"],
            options=result["options"],
            session_id=result["session_id"],
        )
