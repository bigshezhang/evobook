"""Invite system API endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.auth import get_current_user_id
from app.core.error_codes import ERROR_INTERNAL
from app.core.logging import get_logger
from app.domain.repositories.invite_repository import InviteRepository
from app.domain.repositories.profile_repository import ProfileRepository
from app.domain.services.invite_service import InviteService
from app.infrastructure.database import get_db_session
from app.api.routes import INVITE_PREFIX

logger = get_logger(__name__)
router = APIRouter(tags=["invite"])


class InviteCodeResponse(BaseModel):
    invite_code: str
    formatted_code: str
    invite_url: str
    successful_invites_count: int


class BindInviteRequest(BaseModel):
    invite_code: str = Field(..., description="Invite code to bind (6 characters)")


class BindInviteResponse(BaseModel):
    success: bool
    inviter_name: str | None = None
    reward: dict | None = None


@router.get("/profile/invite-code", response_model=InviteCodeResponse)
async def get_invite_code(
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict:
    """Get or create user's invite code."""
    try:
        settings = get_settings()
        invite_repo = InviteRepository(db)
        profile_repo = ProfileRepository(db)
        service = InviteService(invite_repo=invite_repo, profile_repo=profile_repo)
        return await service.get_or_create_invite_code(user_id=user_id, base_url=settings.app_base_url)
    except Exception as e:
        logger.error("Failed to get invite code", user_id=str(user_id), error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": ERROR_INTERNAL, "message": "Failed to get invite code"}},
        )


@router.post("/auth/bind-invite", response_model=BindInviteResponse)
async def bind_invite_code(
    request: BindInviteRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict:
    """Bind user to an invite code and grant rewards."""
    try:
        invite_repo = InviteRepository(db)
        profile_repo = ProfileRepository(db)
        service = InviteService(invite_repo=invite_repo, profile_repo=profile_repo)
        result = await service.bind_invite_code(invitee_id=user_id, invite_code=request.invite_code)

        if not result["success"]:
            error_messages = {
                "already_bound": "You have already used an invite code",
                "invalid_code": "Invalid invite code",
                "self_invite": "You cannot use your own invite code",
            }
            error_code = result["error"].upper()
            error_message = error_messages.get(result["error"], "Failed to bind invite code")
            logger.warning("Invite binding failed", user_id=str(user_id), invite_code=request.invite_code, error=result["error"])
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": {"code": error_code, "message": error_message}},
            )

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to bind invite code", user_id=str(user_id), error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": ERROR_INTERNAL, "message": "Failed to bind invite code"}},
        )
