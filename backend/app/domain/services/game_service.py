"""Game service for managing currency and progression."""

import random
from typing import Any
from uuid import UUID

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
    NODE_REWARD_QUIZ_EXP,
    NODE_REWARD_REGULAR_EXP,
    REWARD_TYPE_DICE,
    REWARD_TYPE_EXP,
    REWARD_TYPE_GOLD,
)
from app.domain.models.game_transaction import GameTransaction
from app.domain.models.user_inventory import UserInventory
from app.domain.repositories.game_transaction_repository import GameTransactionRepository
from app.domain.repositories.profile_repository import ProfileRepository
from app.domain.repositories.shop_item_repository import ShopItemRepository
from app.domain.repositories.user_inventory_repository import UserInventoryRepository

logger = get_logger(__name__)


class GameService:
    """Service for game currency and progression logic."""

    def __init__(
        self,
        profile_repo: ProfileRepository,
        game_transaction_repo: GameTransactionRepository,
        shop_item_repo: ShopItemRepository,
        user_inventory_repo: UserInventoryRepository,
    ) -> None:
        """Initialize game service.

        Args:
            profile_repo: Repository for profile data access.
            game_transaction_repo: Repository for game transactions.
            shop_item_repo: Repository for shop items.
            user_inventory_repo: Repository for user inventory.
        """
        self.profile_repo = profile_repo
        self.game_transaction_repo = game_transaction_repo
        self.shop_item_repo = shop_item_repo
        self.user_inventory_repo = user_inventory_repo

    @staticmethod
    def calculate_exp_for_level(level: int) -> int:
        """Calculate total EXP required to reach a given level.

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
                exp_in_level = total_exp - accumulated
                return (level, exp_in_level, exp_needed)
            accumulated += exp_needed
            level += 1
            if level >= 100:
                return (100, 0, 0)

    async def get_user_currency(self, user_id: UUID) -> dict[str, Any]:
        """Get user's current currency status.

        Args:
            user_id: User UUID

        Returns:
            Dict containing gold_balance, dice_rolls_count, level, current_exp, etc.
        """
        profile = await self.profile_repo.find_by_id(user_id)
        if not profile:
            raise AppException(status_code=404, error_code="PROFILE_NOT_FOUND", message="User profile not found")

        level = profile.level
        exp_to_next = 100 + 50 * (level - 1)
        exp_progress_percent = (profile.current_exp / exp_to_next * 100) if exp_to_next > 0 else 0.0

        return {
            "gold_balance": profile.gold_balance,
            "dice_rolls_count": profile.dice_rolls_count,
            "level": profile.level,
            "current_exp": profile.current_exp,
            "exp_to_next_level": exp_to_next,
            "exp_progress_percent": round(exp_progress_percent, 1),
        }

    async def roll_dice(
        self,
        user_id: UUID,
        course_map_id: UUID | None = None,
        current_position: int | None = None,
    ) -> dict[str, Any]:
        """Roll dice and deduct one dice roll from user.

        Args:
            user_id: User UUID
            course_map_id: Optional course map context
            current_position: Optional current position on travel board

        Returns:
            Dict containing success, dice_result, dice_rolls_remaining, message
        """
        profile = await self.profile_repo.find_by_id(user_id)
        if not profile:
            raise AppException(status_code=404, error_code=ERROR_PROFILE_NOT_FOUND, message="User profile not found")
        if profile.dice_rolls_count <= 0:
            raise AppException(status_code=400, error_code=ERROR_INSUFFICIENT_DICE, message="No dice rolls available")

        dice_result = random.randint(DICE_MIN_VALUE, DICE_MAX_VALUE)
        profile.dice_rolls_count -= 1

        transaction = GameTransaction(
            user_id=user_id, transaction_type="use_dice", amount=-1, source="dice_roll",
            source_detail={"dice_result": dice_result, "course_map_id": str(course_map_id) if course_map_id else None, "current_position": current_position},
        )
        await self.game_transaction_repo.create(transaction)
        await self.profile_repo.commit()
        await self.profile_repo.refresh(profile)

        logger.info("Dice rolled", user_id=str(user_id), dice_result=dice_result, remaining_dice=profile.dice_rolls_count)
        return {"success": True, "dice_result": dice_result, "dice_rolls_remaining": profile.dice_rolls_count, "message": "Dice rolled successfully"}

    async def claim_reward(
        self, user_id: UUID, reward_type: str, amount: int, source: str,
        source_details: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Claim a reward (gold, dice, or exp).

        Args:
            user_id: User UUID
            reward_type: Type of reward ('gold', 'dice', 'exp')
            amount: Amount of reward
            source: Source of reward
            source_details: Optional details about the source

        Returns:
            Dict containing success status, reward details, and new balance
        """
        if amount <= 0:
            raise AppException(status_code=400, error_code=ERROR_INVALID_AMOUNT, message="Reward amount must be positive")
        valid_types = {REWARD_TYPE_GOLD, REWARD_TYPE_DICE, REWARD_TYPE_EXP}
        if reward_type not in valid_types:
            raise AppException(status_code=400, error_code=ERROR_INVALID_REWARD_TYPE, message=f"Invalid reward type: {reward_type}. Must be one of {valid_types}")

        profile = await self.profile_repo.find_by_id(user_id)
        if not profile:
            raise AppException(status_code=404, error_code=ERROR_PROFILE_NOT_FOUND, message="User profile not found")

        new_balance: int = 0
        if reward_type == "gold":
            profile.gold_balance += amount
            new_balance = profile.gold_balance
        elif reward_type == "dice":
            profile.dice_rolls_count += amount
            new_balance = profile.dice_rolls_count
        elif reward_type == "exp":
            profile.current_exp += amount
            new_balance = profile.current_exp

        transaction = GameTransaction(user_id=user_id, transaction_type=f"earn_{reward_type}", amount=amount, source=source, source_detail=source_details)
        await self.game_transaction_repo.create(transaction)
        await self.profile_repo.commit()
        await self.profile_repo.refresh(profile)

        logger.info("Reward claimed", user_id=str(user_id), reward_type=reward_type, amount=amount, source=source, new_balance=new_balance)
        return {"success": True, "reward_type": reward_type, "amount": amount, "new_balance": new_balance, "message": "Reward claimed successfully"}

    async def earn_exp(
        self, user_id: UUID, amount: int, source: str,
        gold_reward: int = 0, dice_reward: int = 0,
        source_details: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Add experience points to user and apply base + level-up rewards.

        Args:
            user_id: User UUID
            amount: Amount of EXP to add
            source: Source of EXP
            gold_reward: Base gold reward
            dice_reward: Base dice roll reward
            source_details: Optional details about the source

        Returns:
            Dict containing success, exp_earned, current_exp, current_level, etc.
        """
        if amount <= 0:
            raise AppException(status_code=400, error_code=ERROR_INVALID_AMOUNT, message="EXP amount must be positive")

        profile = await self.profile_repo.find_by_id(user_id)
        if not profile:
            raise AppException(status_code=404, error_code=ERROR_PROFILE_NOT_FOUND, message="User profile not found")

        old_level = profile.level
        old_exp = profile.current_exp
        profile.current_exp += amount

        total_gold_reward = gold_reward
        total_dice_reward = dice_reward
        level_up = False
        levels_gained = 0

        while True:
            exp_to_next = 100 + 50 * (profile.level - 1)
            if profile.current_exp >= exp_to_next:
                profile.current_exp -= exp_to_next
                profile.level += 1
                levels_gained += 1
                level_up = True
                total_gold_reward += 100
                total_dice_reward += 2
                logger.info("User leveled up", user_id=str(user_id), old_level=old_level, new_level=profile.level)
            else:
                break

        if total_gold_reward > 0:
            profile.gold_balance += total_gold_reward
            gold_txn = GameTransaction(
                user_id=user_id, transaction_type="earn_gold", amount=total_gold_reward, source=source,
                source_detail={"base_gold": gold_reward, "level_up_gold": total_gold_reward - gold_reward, "levels_gained": levels_gained, **(source_details or {})},
            )
            await self.game_transaction_repo.create(gold_txn)

        if total_dice_reward > 0:
            profile.dice_rolls_count += total_dice_reward
            dice_txn = GameTransaction(
                user_id=user_id, transaction_type="earn_dice", amount=total_dice_reward, source=source,
                source_detail={"base_dice": dice_reward, "level_up_dice": total_dice_reward - dice_reward, "levels_gained": levels_gained, **(source_details or {})},
            )
            await self.game_transaction_repo.create(dice_txn)

        exp_txn = GameTransaction(user_id=user_id, transaction_type="earn_exp", amount=amount, source=source, source_detail=source_details)
        await self.game_transaction_repo.create(exp_txn)
        await self.profile_repo.commit()
        await self.profile_repo.refresh(profile)

        logger.info("EXP earned", user_id=str(user_id), amount=amount, source=source, old_exp=old_exp, new_exp=profile.current_exp, level_up=level_up, levels_gained=levels_gained, total_gold_reward=total_gold_reward, total_dice_reward=total_dice_reward)
        return {"success": True, "exp_earned": amount, "current_exp": profile.current_exp, "current_level": profile.level, "level_up": level_up, "rewards": {"gold": total_gold_reward, "dice_rolls": total_dice_reward}}

    @staticmethod
    async def calculate_learning_reward(
        estimated_minutes: int, reward_multiplier: float = 1.0, actual_seconds: int | None = None,
    ) -> dict[str, int]:
        """Calculate rewards for completing a learning node.

        Args:
            estimated_minutes: Estimated time for the node
            reward_multiplier: Reward multiplier from DAG (1.0-3.0)
            actual_seconds: Actual time spent (optional)

        Returns:
            Dict containing gold and exp rewards
        """
        base_gold = int(estimated_minutes * 10 * reward_multiplier)
        base_exp = int(estimated_minutes * 5 * reward_multiplier)
        return {"gold": base_gold, "exp": base_exp}

    async def claim_gift_reward(
        self, user_id: UUID, source_details: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Claim a gift reward from the travel board.

        Args:
            user_id: User UUID
            source_details: Optional details

        Returns:
            Dict with reward_type, item details or gold amount
        """
        unowned_items = await self.shop_item_repo.find_unowned_by_user(user_id)

        if not unowned_items:
            fallback_gold = 200
            profile = await self.profile_repo.find_by_id(user_id)
            if not profile:
                raise AppException(status_code=404, error_code=ERROR_PROFILE_NOT_FOUND, message="User profile not found")

            profile.gold_balance += fallback_gold
            transaction = GameTransaction(user_id=user_id, transaction_type="earn_gold", amount=fallback_gold, source="gift_fallback_all_owned", source_detail=source_details)
            await self.game_transaction_repo.create(transaction)
            await self.profile_repo.commit()
            await self.profile_repo.refresh(profile)

            logger.info("Gift reward fallback to gold (all items owned)", user_id=str(user_id), gold_amount=fallback_gold)
            return {"success": True, "reward_type": "gold", "gold_amount": fallback_gold, "item": None, "message": "You already own all items! Here's some gold instead."}

        chosen_item = random.choice(unowned_items)

        # Grant item to user
        from app.domain.services.inventory_service import InventoryService
        inv_service = InventoryService(
            user_inventory_repo=self.user_inventory_repo,
            shop_item_repo=self.shop_item_repo,
            profile_repo=self.profile_repo,
        )
        grant_result = await inv_service.grant_item(user_id=user_id, item_id=chosen_item.id, source="tile_gift")

        transaction = GameTransaction(
            user_id=user_id, transaction_type="earn_item", amount=1, source="tile_gift",
            source_detail={**(source_details or {}), "item_id": str(chosen_item.id), "item_name": chosen_item.name, "item_type": chosen_item.item_type},
        )
        await self.game_transaction_repo.create(transaction)
        await self.profile_repo.commit()

        logger.info("Gift reward item granted", user_id=str(user_id), item_id=str(chosen_item.id), item_name=chosen_item.name, item_type=chosen_item.item_type)
        return {"success": True, "reward_type": "item", "gold_amount": None, "item": grant_result["item"], "message": f"You received: {chosen_item.name}!"}
