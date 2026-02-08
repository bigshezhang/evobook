"""Shop service for managing shop items and purchases."""

from typing import Any
from uuid import UUID

from app.core.error_codes import (
    ERROR_INSUFFICIENT_GOLD,
    ERROR_ITEM_NOT_FOUND,
    ERROR_PROFILE_NOT_FOUND,
)
from app.core.exceptions import AppException
from app.core.logging import get_logger
from app.domain.models.game_transaction import GameTransaction
from app.domain.models.user_inventory import UserInventory
from app.domain.repositories.game_transaction_repository import GameTransactionRepository
from app.domain.repositories.profile_repository import ProfileRepository
from app.domain.repositories.shop_item_repository import ShopItemRepository
from app.domain.repositories.user_inventory_repository import UserInventoryRepository

logger = get_logger(__name__)


class ShopService:
    """Service for shop item management and purchases."""

    def __init__(
        self,
        shop_item_repo: ShopItemRepository,
        user_inventory_repo: UserInventoryRepository,
        profile_repo: ProfileRepository,
        game_transaction_repo: GameTransactionRepository,
    ) -> None:
        """Initialize shop service.

        Args:
            shop_item_repo: Repository for shop items.
            user_inventory_repo: Repository for user inventory.
            profile_repo: Repository for profiles.
            game_transaction_repo: Repository for game transactions.
        """
        self.shop_item_repo = shop_item_repo
        self.user_inventory_repo = user_inventory_repo
        self.profile_repo = profile_repo
        self.game_transaction_repo = game_transaction_repo

    async def get_shop_items(
        self, user_id: UUID, item_type: str | None = None, rarity: str | None = None,
    ) -> dict[str, Any]:
        """Get shop items with user ownership status.

        Args:
            user_id: User UUID
            item_type: Optional filter by item type
            rarity: Optional filter by rarity

        Returns:
            Dict containing items list and total count
        """
        shop_items = await self.shop_item_repo.find_all(item_type=item_type, rarity=rarity)
        owned_items = await self.user_inventory_repo.find_all_by_user(user_id)

        owned_item_ids = {inv.item_id for inv in owned_items}
        equipped_item_ids = {inv.item_id for inv in owned_items if inv.is_equipped}

        items_data = [
            {
                "id": str(item.id), "name": item.name, "item_type": item.item_type,
                "price": item.price, "image_path": item.image_path, "rarity": item.rarity,
                "owned": item.id in owned_item_ids, "is_equipped": item.id in equipped_item_ids,
            }
            for item in shop_items
        ]

        logger.info("Shop items retrieved", user_id=str(user_id), total_items=len(items_data), item_type=item_type, rarity=rarity)
        return {"items": items_data, "total": len(items_data)}

    async def purchase_item(self, user_id: UUID, item_id: UUID) -> dict[str, Any]:
        """Purchase a shop item.

        Args:
            user_id: User UUID
            item_id: Shop item UUID

        Returns:
            Dict containing success status, item info, and remaining gold
        """
        item = await self.shop_item_repo.find_by_id(item_id)
        if not item:
            raise AppException(status_code=404, error_code=ERROR_ITEM_NOT_FOUND, message="Shop item not found")

        existing_ownership = await self.user_inventory_repo.find_ownership_for_update(user_id, item_id)
        if existing_ownership:
            raise AppException(status_code=400, error_code="ALREADY_OWNED", message="You already own this item")

        profile = await self.profile_repo.find_by_id_for_update(user_id)
        if not profile:
            raise AppException(status_code=404, error_code=ERROR_PROFILE_NOT_FOUND, message="User profile not found")
        if profile.gold_balance < item.price:
            raise AppException(status_code=400, error_code=ERROR_INSUFFICIENT_GOLD, message=f"Insufficient gold. Required: {item.price}, Available: {profile.gold_balance}")

        profile.gold_balance -= item.price
        inventory_item = UserInventory(user_id=user_id, item_id=item_id, is_equipped=False)
        await self.user_inventory_repo.create(inventory_item)

        transaction = GameTransaction(
            user_id=user_id, transaction_type="spend_gold", amount=-item.price, source="shop_purchase",
            source_detail={"item_id": str(item_id), "item_name": item.name, "item_type": item.item_type},
        )
        await self.game_transaction_repo.create(transaction)
        await self.profile_repo.commit()
        await self.profile_repo.refresh(profile)

        logger.info("Item purchased", user_id=str(user_id), item_id=str(item_id), item_name=item.name, price=item.price, gold_remaining=profile.gold_balance)
        return {"success": True, "item": {"id": str(item.id), "name": item.name, "price": item.price}, "gold_remaining": profile.gold_balance, "message": "Item purchased successfully"}

    async def seed_initial_items(self, items_data: list[dict[str, Any]]) -> dict[str, Any]:
        """Seed initial shop items (idempotent).

        Args:
            items_data: List of item dictionaries

        Returns:
            Dict with success status and count
        """
        from app.domain.models.shop_item import ShopItem

        created_count = 0
        skipped_count = 0

        for item_data in items_data:
            existing = await self.shop_item_repo.find_by_name(item_data["name"])
            if existing:
                skipped_count += 1
                continue

            item = ShopItem(
                name=item_data["name"], item_type=item_data["item_type"],
                price=item_data["price"], image_path=item_data["image_path"],
                rarity=item_data.get("rarity", "common"), is_default=item_data.get("is_default", False),
            )
            await self.shop_item_repo.save(item)
            created_count += 1

        await self.shop_item_repo.commit()

        logger.info("Shop items seeded", created_count=created_count, skipped_count=skipped_count)
        return {"success": True, "created": created_count, "skipped": skipped_count, "total": len(items_data)}
