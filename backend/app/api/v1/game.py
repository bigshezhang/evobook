"""Game API endpoints for currency and progression."""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.error_codes import ERROR_INTERNAL, ERROR_INVALID_UUID
from app.core.exceptions import AppException
from app.core.logging import get_logger
from app.domain.repositories.game_transaction_repository import GameTransactionRepository
from app.domain.repositories.profile_repository import ProfileRepository
from app.domain.repositories.shop_item_repository import ShopItemRepository
from app.domain.repositories.user_inventory_repository import UserInventoryRepository
from app.domain.services.game_service import GameService
from app.infrastructure.database import get_db_session
from app.api.routes import GAME_PREFIX

logger = get_logger(__name__)

router = APIRouter(prefix=GAME_PREFIX, tags=["game"])


class CurrencyResponse(BaseModel):
    gold_balance: int = Field(..., description="Gold balance")
    dice_rolls_count: int = Field(..., description="Number of dice rolls available")
    level: int = Field(..., description="User level")
    current_exp: int = Field(..., description="Current EXP in current level")
    exp_to_next_level: int = Field(..., description="EXP required to reach next level")
    exp_progress_percent: float = Field(..., description="Progress percentage to next level")


class RollDiceRequest(BaseModel):
    course_map_id: str = Field(..., description="Course map UUID")
    current_position: int = Field(..., description="Current position on travel board")


class RollDiceResponse(BaseModel):
    success: bool
    dice_result: int
    dice_rolls_remaining: int
    message: str


class ClaimRewardRequest(BaseModel):
    reward_type: str = Field(..., description="Type of reward: 'gold', 'dice', or 'exp'")
    amount: int = Field(..., description="Amount of reward", gt=0)
    source: str = Field(..., description="Source of reward")
    source_details: dict[str, Any] | None = Field(default=None, description="Optional source details")


class ClaimRewardResponse(BaseModel):
    success: bool
    reward_type: str
    amount: int
    new_balance: int
    message: str


class ClaimGiftRequest(BaseModel):
    source_details: dict[str, Any] | None = Field(default=None, description="Optional source details")


class GiftItemInfo(BaseModel):
    id: str
    name: str
    item_type: str
    image_path: str
    rarity: str


class ClaimGiftResponse(BaseModel):
    success: bool
    reward_type: str
    gold_amount: int | None = None
    item: GiftItemInfo | None = None
    message: str


class EarnExpRequest(BaseModel):
    exp_amount: int = Field(..., description="Amount of EXP to earn", gt=0)
    gold_reward: int = Field(default=0, description="Base gold reward", ge=0)
    dice_reward: int = Field(default=0, description="Base dice roll reward", ge=0)
    source: str = Field(..., description="Source of EXP")
    source_details: dict[str, Any] | None = Field(default=None, description="Optional source details")


class RewardsSummary(BaseModel):
    gold: int
    dice_rolls: int


class EarnExpResponse(BaseModel):
    success: bool
    exp_earned: int
    current_exp: int
    current_level: int
    level_up: bool
    rewards: RewardsSummary


def _build_game_service(db: AsyncSession) -> GameService:
    """Build a GameService with all required repositories."""
    return GameService(
        profile_repo=ProfileRepository(db),
        game_transaction_repo=GameTransactionRepository(db),
        shop_item_repo=ShopItemRepository(db),
        user_inventory_repo=UserInventoryRepository(db),
    )


@router.get("/currency", response_model=CurrencyResponse)
async def get_currency(
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, Any]:
    """Get user's current currency status."""
    try:
        return await _build_game_service(db).get_user_currency(user_id=user_id)
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": ERROR_INTERNAL, "message": str(e)})


@router.post("/roll-dice", response_model=RollDiceResponse)
async def roll_dice(
    request: RollDiceRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, Any]:
    """Roll dice and deduct one dice roll."""
    try:
        course_map_id = UUID(request.course_map_id)
        return await _build_game_service(db).roll_dice(
            user_id=user_id, course_map_id=course_map_id, current_position=request.current_position,
        )
    except ValueError:
        raise HTTPException(status_code=400, detail={"code": ERROR_INVALID_UUID, "message": "Invalid course map UUID"})
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": ERROR_INTERNAL, "message": str(e)})


@router.post("/claim-reward", response_model=ClaimRewardResponse)
async def claim_reward(
    request: ClaimRewardRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, Any]:
    """Claim a reward (gold, dice, or exp)."""
    try:
        return await _build_game_service(db).claim_reward(
            user_id=user_id, reward_type=request.reward_type, amount=request.amount,
            source=request.source, source_details=request.source_details,
        )
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": ERROR_INTERNAL, "message": str(e)})


@router.post("/claim-gift", response_model=ClaimGiftResponse)
async def claim_gift(
    request: ClaimGiftRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, Any]:
    """Claim a gift reward from the travel board."""
    try:
        return await _build_game_service(db).claim_gift_reward(
            user_id=user_id, source_details=request.source_details,
        )
    except AppException:
        raise
    except Exception as e:
        logger.error("Unexpected error claiming gift reward", user_id=str(user_id), error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail={"code": ERROR_INTERNAL, "message": str(e)})


@router.post("/earn-exp", response_model=EarnExpResponse)
async def earn_exp(
    request: EarnExpRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, Any]:
    """Earn experience points and potentially level up."""
    try:
        return await _build_game_service(db).earn_exp(
            user_id=user_id, amount=request.exp_amount, gold_reward=request.gold_reward,
            dice_reward=request.dice_reward, source=request.source, source_details=request.source_details,
        )
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": ERROR_INTERNAL, "message": str(e)})
