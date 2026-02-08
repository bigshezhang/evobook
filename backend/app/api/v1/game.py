"""Game API endpoints for currency and progression.

This module provides endpoints for managing game currency (gold, dice rolls),
experience points, and user progression.
"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.exceptions import AppException
from app.domain.services.game_service import GameService
from app.infrastructure.database import get_db_session

router = APIRouter(prefix="/game", tags=["game"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class CurrencyResponse(BaseModel):
    """User currency status response."""

    gold_balance: int = Field(..., description="Gold balance")
    dice_rolls_count: int = Field(..., description="Number of dice rolls available")
    level: int = Field(..., description="User level")
    current_exp: int = Field(..., description="Current EXP in current level")
    exp_to_next_level: int = Field(..., description="EXP required to reach next level")
    exp_progress_percent: float = Field(..., description="Progress percentage to next level")


class RollDiceRequest(BaseModel):
    """Roll dice request."""

    course_map_id: str = Field(..., description="Course map UUID")
    current_position: int = Field(..., description="Current position on travel board")


class RollDiceResponse(BaseModel):
    """Roll dice response."""

    success: bool = Field(..., description="Whether the roll was successful")
    dice_result: int = Field(..., description="Dice roll result (1-4)")
    dice_rolls_remaining: int = Field(..., description="Remaining dice rolls")
    message: str = Field(..., description="Response message")


class ClaimRewardRequest(BaseModel):
    """Claim reward request."""

    reward_type: str = Field(..., description="Type of reward: 'gold', 'dice', or 'exp'")
    amount: int = Field(..., description="Amount of reward", gt=0)
    source: str = Field(..., description="Source of reward (e.g., 'tile_reward', 'learning_reward')")
    source_details: dict[str, Any] | None = Field(
        default=None,
        description="Optional source details (course_map_id, tile_position, tile_type, etc.)"
    )


class ClaimRewardResponse(BaseModel):
    """Claim reward response."""

    success: bool = Field(..., description="Whether the reward was claimed successfully")
    reward_type: str = Field(..., description="Type of reward claimed")
    amount: int = Field(..., description="Amount of reward claimed")
    new_balance: int = Field(..., description="New balance of the reward type")
    message: str = Field(..., description="Response message")


class EarnExpRequest(BaseModel):
    """Earn EXP request."""

    exp_amount: int = Field(..., description="Amount of EXP to earn", gt=0)
    source: str = Field(..., description="Source of EXP (e.g., 'learning_reward', 'quiz_completion')")
    source_details: dict[str, Any] | None = Field(
        default=None,
        description="Optional source details (course_map_id, node_id, activity_type, etc.)"
    )


class LevelUpRewards(BaseModel):
    """Level up rewards."""

    gold: int = Field(..., description="Gold reward amount")
    dice_rolls: int = Field(..., description="Dice rolls reward amount")


class EarnExpResponse(BaseModel):
    """Earn EXP response."""

    success: bool = Field(..., description="Whether EXP was earned successfully")
    exp_earned: int = Field(..., description="Amount of EXP earned")
    current_exp: int = Field(..., description="Current EXP in current level")
    current_level: int = Field(..., description="Current level")
    level_up: bool = Field(..., description="Whether user leveled up")
    rewards: LevelUpRewards | None = Field(
        default=None,
        description="Level up rewards (gold and dice_rolls) if leveled up"
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/currency", response_model=CurrencyResponse)
async def get_currency(
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, Any]:
    """Get user's current currency status.

    Returns:
        User's gold, dice rolls, level, and EXP status.
    """
    try:
        return await GameService.get_user_currency(user_id=user_id, db=db)
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": str(e)},
        )


@router.post("/roll-dice", response_model=RollDiceResponse)
async def roll_dice(
    request: RollDiceRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, Any]:
    """Roll dice and deduct one dice roll.

    Args:
        request: Roll dice request with course map and current position.
        user_id: Authenticated user ID from JWT.
        db: Database session.

    Returns:
        Dice roll result, remaining dice rolls, and success status.

    Raises:
        400: INSUFFICIENT_DICE if no dice rolls available
        400: INVALID_UUID if course map UUID is invalid
    """
    try:
        course_map_id = UUID(request.course_map_id)

        return await GameService.roll_dice(
            user_id=user_id,
            db=db,
            course_map_id=course_map_id,
            current_position=request.current_position,
        )
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_UUID", "message": "Invalid course map UUID"},
        )
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": str(e)},
        )


@router.post("/claim-reward", response_model=ClaimRewardResponse)
async def claim_reward(
    request: ClaimRewardRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, Any]:
    """Claim a reward (gold, dice, or exp).

    Args:
        request: Reward claim request with type, amount, source, and details.
        user_id: Authenticated user ID from JWT.
        db: Database session.

    Returns:
        Success status, reward details, and new balance.

    Raises:
        400: INVALID_REWARD_TYPE if reward type is not 'gold', 'dice', or 'exp'
        400: INVALID_AMOUNT if amount is not positive
    """
    try:
        return await GameService.claim_reward(
            user_id=user_id,
            reward_type=request.reward_type,
            amount=request.amount,
            source=request.source,
            db=db,
            source_details=request.source_details,
        )
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": str(e)},
        )


@router.post("/earn-exp", response_model=EarnExpResponse)
async def earn_exp(
    request: EarnExpRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, Any]:
    """Earn experience points and potentially level up.

    When leveling up, user receives rewards:
    - 100 gold per level
    - 2 dice rolls per level

    Args:
        request: EXP earning request with amount, source, and optional details.
        user_id: Authenticated user ID from JWT.
        db: Database session.

    Returns:
        Success status, EXP earned, current EXP/level, level up flag, and rewards if leveled up.

    Raises:
        400: INVALID_AMOUNT if exp_amount is not positive
    """
    try:
        return await GameService.earn_exp(
            user_id=user_id,
            amount=request.exp_amount,
            source=request.source,
            db=db,
            source_details=request.source_details,
        )
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": str(e)},
        )
