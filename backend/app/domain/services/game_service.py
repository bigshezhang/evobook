"""Game service for managing currency and progression."""

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.error_codes import (
    ERROR_INSUFFICIENT_DICE,
    ERROR_INVALID_AMOUNT,
    ERROR_INVALID_REWARD_TYPE,
    ERROR_PROFILE_NOT_FOUND,
)
from app.core.exceptions import AppException
from app.core.logging import get_logger
from app.domain.constants import (
    DICE_MAX_VALUE,
    DICE_MIN_VALUE,
    NODE_REWARD_BOSS_EXP,
    NODE_REWARD_QUIZ_EXP,
    NODE_REWARD_REGULAR_EXP,
    NODE_TYPE_BOSS,
    NODE_TYPE_QUIZ,
    REWARD_TYPE_DICE,
    REWARD_TYPE_EXP,
    REWARD_TYPE_GOLD,
)
from app.domain.models.game_transaction import GameTransaction
from app.domain.models.profile import Profile

logger = get_logger(__name__)


class GameService:
    """Service for game currency and progression logic."""

    @staticmethod
    def calculate_exp_for_level(level: int) -> int:
        """Calculate total EXP required to reach a given level.

        Level 1 → 2 requires 100 EXP
        Level 2 → 3 requires 150 EXP
        Level N → N+1 requires (100 + 50 * (N-1)) EXP

        Args:
            level: Target level (1-based)

        Returns:
            Total EXP required to reach this level from level 1
        """
        if level <= 1:
            return 0

        total_exp = 0
        for lvl in range(1, level):
            total_exp += 100 + 50 * (lvl - 1)
        return total_exp

    @staticmethod
    def calculate_level_from_exp(total_exp: int) -> tuple[int, int, int]:
        """Calculate level, current EXP, and EXP to next level.

        Args:
            total_exp: Total accumulated experience points

        Returns:
            Tuple of (level, exp_in_current_level, exp_to_next_level)
        """
        level = 1
        accumulated = 0

        while True:
            exp_needed = 100 + 50 * (level - 1)
            if accumulated + exp_needed > total_exp:
                # Current level
                exp_in_level = total_exp - accumulated
                return (level, exp_in_level, exp_needed)

            accumulated += exp_needed
            level += 1

            # Safety cap at level 100
            if level >= 100:
                return (100, 0, 0)

    @staticmethod
    async def get_user_currency(
        user_id: UUID,
        db: AsyncSession,
    ) -> dict[str, Any]:
        """Get user's current currency status.

        Args:
            user_id: User UUID
            db: Database session

        Returns:
            Dict containing gold_balance, dice_rolls_count, level, current_exp,
            exp_to_next_level, exp_progress_percent

        Raises:
            AppException: If profile not found
        """
        stmt = select(Profile).where(Profile.id == user_id)
        result = await db.execute(stmt)
        profile = result.scalar_one_or_none()

        if not profile:
            raise AppException(
                status_code=404,
                error_code="PROFILE_NOT_FOUND",
                message="User profile not found",
            )

        # Calculate EXP to next level
        level = profile.level
        exp_to_next = 100 + 50 * (level - 1)

        # Calculate progress percentage
        exp_progress_percent = (profile.current_exp / exp_to_next * 100) if exp_to_next > 0 else 0.0

        return {
            "gold_balance": profile.gold_balance,
            "dice_rolls_count": profile.dice_rolls_count,
            "level": profile.level,
            "current_exp": profile.current_exp,
            "exp_to_next_level": exp_to_next,
            "exp_progress_percent": round(exp_progress_percent, 1),
        }

    @staticmethod
    async def roll_dice(
        user_id: UUID,
        db: AsyncSession,
        course_map_id: UUID | None = None,
        current_position: int | None = None,
    ) -> dict[str, Any]:
        """Roll dice and deduct one dice roll from user.

        Args:
            user_id: User UUID
            db: Database session
            course_map_id: Optional course map context
            current_position: Optional current position on travel board

        Returns:
            Dict containing success, dice_result (1-4), dice_rolls_remaining, and message

        Raises:
            AppException: If no dice rolls available or profile not found
        """
        import random

        stmt = select(Profile).where(Profile.id == user_id)
        result = await db.execute(stmt)
        profile = result.scalar_one_or_none()

        if not profile:
            raise AppException(
                status_code=404,
                error_code=ERROR_PROFILE_NOT_FOUND,
                message="User profile not found",
            )

        if profile.dice_rolls_count <= 0:
            raise AppException(
                status_code=400,
                error_code=ERROR_INSUFFICIENT_DICE,
                message="No dice rolls available",
            )

        # Roll dice (min-max range from constants)
        dice_result = random.randint(DICE_MIN_VALUE, DICE_MAX_VALUE)

        # Deduct dice roll
        profile.dice_rolls_count -= 1

        # Record transaction
        transaction = GameTransaction(
            user_id=user_id,
            transaction_type="use_dice",
            amount=-1,
            source="dice_roll",
            source_detail={
                "dice_result": dice_result,
                "course_map_id": str(course_map_id) if course_map_id else None,
                "current_position": current_position,
            },
        )
        db.add(transaction)

        await db.commit()
        await db.refresh(profile)

        logger.info(
            "Dice rolled",
            user_id=str(user_id),
            dice_result=dice_result,
            remaining_dice=profile.dice_rolls_count,
            current_position=current_position,
        )

        return {
            "success": True,
            "dice_result": dice_result,
            "dice_rolls_remaining": profile.dice_rolls_count,
            "message": "Dice rolled successfully",
        }

    @staticmethod
    async def claim_reward(
        user_id: UUID,
        reward_type: str,
        amount: int,
        source: str,
        db: AsyncSession,
        source_details: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Claim a reward (gold, dice, or exp).

        Args:
            user_id: User UUID
            reward_type: Type of reward ('gold', 'dice', 'exp')
            amount: Amount of reward
            source: Source of reward (e.g., 'tile_reward', 'learning_reward')
            db: Database session
            source_details: Optional details about the source

        Returns:
            Dict containing success status, reward details, and new balance

        Raises:
            AppException: If invalid reward type, invalid amount, or profile not found
        """
        # Validate amount
        if amount <= 0:
            raise AppException(
                status_code=400,
                error_code=ERROR_INVALID_AMOUNT,
                message="Reward amount must be positive",
            )

        # Validate reward type
        valid_types = {REWARD_TYPE_GOLD, REWARD_TYPE_DICE, REWARD_TYPE_EXP}
        if reward_type not in valid_types:
            raise AppException(
                status_code=400,
                error_code=ERROR_INVALID_REWARD_TYPE,
                message=f"Invalid reward type: {reward_type}. Must be one of {valid_types}",
            )

        stmt = select(Profile).where(Profile.id == user_id)
        result = await db.execute(stmt)
        profile = result.scalar_one_or_none()

        if not profile:
            raise AppException(
                status_code=404,
                error_code=ERROR_PROFILE_NOT_FOUND,
                message="User profile not found",
            )

        new_balance: int = 0

        if reward_type == "gold":
            profile.gold_balance += amount
            new_balance = profile.gold_balance

            transaction = GameTransaction(
                user_id=user_id,
                transaction_type="earn_gold",
                amount=amount,
                source=source,
                source_detail=source_details,
            )
            db.add(transaction)

        elif reward_type == "dice":
            profile.dice_rolls_count += amount
            new_balance = profile.dice_rolls_count

            transaction = GameTransaction(
                user_id=user_id,
                transaction_type="earn_dice",
                amount=amount,
                source=source,
                source_detail=source_details,
            )
            db.add(transaction)

        elif reward_type == "exp":
            # For exp, we add directly to current_exp
            profile.current_exp += amount
            new_balance = profile.current_exp

            transaction = GameTransaction(
                user_id=user_id,
                transaction_type="earn_exp",
                amount=amount,
                source=source,
                source_detail=source_details,
            )
            db.add(transaction)

        await db.commit()
        await db.refresh(profile)

        logger.info(
            "Reward claimed",
            user_id=str(user_id),
            reward_type=reward_type,
            amount=amount,
            source=source,
            new_balance=new_balance,
        )

        return {
            "success": True,
            "reward_type": reward_type,
            "amount": amount,
            "new_balance": new_balance,
            "message": "Reward claimed successfully",
        }

    @staticmethod
    async def earn_exp(
        user_id: UUID,
        amount: int,
        source: str,
        db: AsyncSession,
        source_details: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Add experience points to user and handle level ups with rewards.

        Args:
            user_id: User UUID
            amount: Amount of EXP to add (must be positive)
            source: Source of EXP (e.g., 'learning_reward', 'quiz_completion')
            db: Database session
            source_details: Optional details about the source

        Returns:
            Dict containing success, exp_earned, current_exp, current_level,
            level_up flag, and rewards (if leveled up)

        Raises:
            AppException: If profile not found or invalid amount
        """
        # Validate amount
        if amount <= 0:
            raise AppException(
                status_code=400,
                error_code=ERROR_INVALID_AMOUNT,
                message="EXP amount must be positive",
            )

        stmt = select(Profile).where(Profile.id == user_id)
        result = await db.execute(stmt)
        profile = result.scalar_one_or_none()

        if not profile:
            raise AppException(
                status_code=404,
                error_code=ERROR_PROFILE_NOT_FOUND,
                message="User profile not found",
            )

        old_level = profile.level
        old_exp = profile.current_exp

        # Add EXP
        profile.current_exp += amount

        # Check for level up and apply rewards
        level_up = False
        total_gold_reward = 0
        total_dice_reward = 0
        levels_gained = 0

        while True:
            exp_to_next = 100 + 50 * (profile.level - 1)
            if profile.current_exp >= exp_to_next:
                profile.current_exp -= exp_to_next
                profile.level += 1
                levels_gained += 1
                level_up = True

                # Level up rewards: 100 gold + 2 dice per level
                total_gold_reward += 100
                total_dice_reward += 2

                logger.info(
                    "User leveled up",
                    user_id=str(user_id),
                    old_level=old_level,
                    new_level=profile.level,
                )
            else:
                break

        # Apply level up rewards
        if level_up:
            profile.gold_balance += total_gold_reward
            profile.dice_rolls_count += total_dice_reward

            # Record level up reward transaction
            if total_gold_reward > 0:
                gold_transaction = GameTransaction(
                    user_id=user_id,
                    transaction_type="earn_gold",
                    amount=total_gold_reward,
                    source="level_up_reward",
                    source_detail={
                        "levels_gained": levels_gained,
                        "from_level": old_level,
                        "to_level": profile.level,
                    },
                )
                db.add(gold_transaction)

            if total_dice_reward > 0:
                dice_transaction = GameTransaction(
                    user_id=user_id,
                    transaction_type="earn_dice",
                    amount=total_dice_reward,
                    source="level_up_reward",
                    source_detail={
                        "levels_gained": levels_gained,
                        "from_level": old_level,
                        "to_level": profile.level,
                    },
                )
                db.add(dice_transaction)

        # Record EXP transaction
        exp_transaction = GameTransaction(
            user_id=user_id,
            transaction_type="earn_exp",
            amount=amount,
            source=source,
            source_detail=source_details,
        )
        db.add(exp_transaction)

        await db.commit()
        await db.refresh(profile)

        logger.info(
            "EXP earned",
            user_id=str(user_id),
            amount=amount,
            source=source,
            old_exp=old_exp,
            new_exp=profile.current_exp,
            level_up=level_up,
            levels_gained=levels_gained,
        )

        response: dict[str, Any] = {
            "success": True,
            "exp_earned": amount,
            "current_exp": profile.current_exp,
            "current_level": profile.level,
            "level_up": level_up,
            "rewards": None,
        }

        if level_up:
            response["rewards"] = {
                "gold": total_gold_reward,
                "dice_rolls": total_dice_reward,
            }

        return response

    @staticmethod
    async def calculate_learning_reward(
        node_type: str,
        estimated_minutes: int,
        actual_seconds: int | None = None,
    ) -> dict[str, int]:
        """Calculate rewards for completing a learning node.

        Args:
            node_type: Type of node ('learn', 'quiz', 'boss')
            estimated_minutes: Estimated time for the node
            actual_seconds: Actual time spent (optional)

        Returns:
            Dict containing gold and exp rewards
        """
        base_gold = estimated_minutes * 10  # 10 gold per minute
        base_exp = estimated_minutes * 5    # 5 exp per minute

        # Bonus for node type
        if node_type == NODE_TYPE_QUIZ:
            base_gold = int(base_gold * 1.5)
            base_exp = int(base_exp * 1.5)
        elif node_type == NODE_TYPE_BOSS:
            base_gold = int(base_gold * 2.0)
            base_exp = int(base_exp * 2.0)

        return {
            "gold": base_gold,
            "exp": base_exp,
        }
