"""Invite system API endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.auth import get_current_user_id
from app.core.logging import get_logger
from app.domain.services.invite_service import InviteService
from app.infrastructure.database import get_db_session

logger = get_logger(__name__)
router = APIRouter(tags=["invite"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class InviteCodeResponse(BaseModel):
    """Response for get invite code endpoint."""
    
    invite_code: str = Field(..., description="Raw invite code (6 characters)")
    formatted_code: str = Field(..., description="Formatted code (EvoBook#AbCdEf)")
    invite_url: str = Field(..., description="Full invite URL with code parameter")
    successful_invites_count: int = Field(..., description="Number of successful invites")


class BindInviteRequest(BaseModel):
    """Request body for binding an invite code."""
    
    invite_code: str = Field(..., description="Invite code to bind (6 characters)")


class BindInviteResponse(BaseModel):
    """Response for bind invite code endpoint."""
    
    success: bool
    inviter_name: str | None = None
    reward: dict | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/profile/invite-code", response_model=InviteCodeResponse)
async def get_invite_code(
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict:
    """Get or create user's invite code.
    
    Returns the user's unique invite code along with the formatted version,
    invite URL, and count of successful invites.
    
    Args:
        user_id: Authenticated user ID from JWT.
        db: Database session.
    
    Returns:
        InviteCodeResponse with invite code details.
    
    Raises:
        401: User not authenticated.
        500: Server error (e.g., failed to generate unique code).
    """
    try:
        settings = get_settings()
        result = await InviteService.get_or_create_invite_code(
            user_id=user_id,
            db=db,
            base_url=settings.app_base_url
        )
        return result
    except Exception as e:
        logger.error("Failed to get invite code", user_id=str(user_id), error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "Failed to get invite code"
                }
            }
        )


@router.post("/auth/bind-invite", response_model=BindInviteResponse)
async def bind_invite_code(
    request: BindInviteRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict:
    """Bind user to an invite code and grant rewards.
    
    This endpoint should be called after a new user completes authentication.
    The invite code is typically stored in localStorage by the frontend when
    the user visits a registration page with ?invite=CODE parameter.
    
    Args:
        request: Request body containing the invite code.
        user_id: Authenticated user ID from JWT.
        db: Database session.
    
    Returns:
        BindInviteResponse with success status and reward details.
    
    Raises:
        400: Already bound, invalid code, or self-invite.
        401: User not authenticated.
        500: Server error.
    """
    try:
        result = await InviteService.bind_invite_code(
            invitee_id=user_id,
            invite_code=request.invite_code,
            db=db
        )
        
        if not result["success"]:
            error_messages = {
                "already_bound": "You have already used an invite code",
                "invalid_code": "Invalid invite code",
                "self_invite": "You cannot use your own invite code"
            }
            error_code = result["error"].upper()
            error_message = error_messages.get(result["error"], "Failed to bind invite code")
            
            logger.warning(
                "Invite binding failed",
                user_id=str(user_id),
                invite_code=request.invite_code,
                error=result["error"]
            )
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": {
                        "code": error_code,
                        "message": error_message
                    }
                }
            )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to bind invite code", user_id=str(user_id), error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "Failed to bind invite code"
                }
            }
        )
