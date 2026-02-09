"""Inventory service for managing user-owned items."""

from typing import Any
from uuid import UUID

from app.core.error_codes import ERROR_ITEM_NOT_FOUND, ERROR_ITEM_NOT_OWNED
from app.core.exceptions import AppException
from app.core.logging import get_logger
from app.domain.models.user_inventory import UserInventory
from app.domain.repositories.profile_repository import ProfileRepository
from app.domain.repositories.shop_item_repository import ShopItemRepository
from app.domain.repositories.user_inventory_repository import UserInventoryRepository

logger = get_logger(__name__)


class InventoryService:
    """Service for user inventory management."""

    def __init__(
        self,
        user_inventory_repo: UserInventoryRepository,
        shop_item_repo: ShopItemRepository,
        profile_repo: ProfileRepository,
    ) -> None:
        """Initialize inventory service.

        Args:
            user_inventory_repo: Repository for user inventory.
            shop_item_repo: Repository for shop items.
            profile_repo: Repository for profiles.
        """
        self.user_inventory_repo = user_inventory_repo
        self.shop_item_repo = shop_item_repo
        self.profile_repo = profile_repo

    async def get_user_inventory(
        self, user_id: UUID, item_type: str | None = None, equipped_only: bool = False,
    ) -> dict[str, Any]:
        """Get user's inventory.

        Args:
            user_id: User UUID
            item_type: Optional filter by item type
            equipped_only: If True, only return equipped items

        Returns:
            Dict containing inventory items and total count
        """
        rows = await self.user_inventory_repo.find_by_user(
            user_id=user_id, item_type=item_type, equipped_only=equipped_only,
        )

        inventory_data = [
            {
                "item_id": str(inv.item_id), "name": item.name, "item_type": item.item_type,
                "image_path": item.image_path, "is_equipped": inv.is_equipped,
                "purchased_at": inv.purchased_at.isoformat(),
            }
            for inv, item in rows
        ]

        logger.info("User inventory retrieved", user_id=str(user_id), total_items=len(inventory_data), item_type=item_type, equipped_only=equipped_only)
        return {"inventory": inventory_data, "total": len(inventory_data)}

    async def equip_item(self, user_id: UUID, item_id: UUID) -> dict[str, Any]:
        """Equip an item.

        For clothes: automatically unequips other clothes.
        For furniture: can equip multiple.

        Args:
            user_id: User UUID
            item_id: Item UUID to equip

        Returns:
            Dict with success status and item info
        """
        row = await self.user_inventory_repo.find_with_item_for_update(user_id, item_id)
        if not row:
            raise AppException(status_code=404, error_code=ERROR_ITEM_NOT_OWNED, message="You don't own this item")

        inv, item = row

        if inv.is_equipped:
            return {"success": True, "item": {"id": str(item.id), "name": item.name, "is_equipped": True}, "message": "Item is already equipped"}

        if item.item_type == "clothes":
            await self.user_inventory_repo.unequip_all_clothes(user_id)
            profile = await self.profile_repo.find_by_id(user_id)
            if profile:
                profile.current_outfit = item.name

        inv.is_equipped = True
        await self.user_inventory_repo.commit()

        logger.info("Item equipped", user_id=str(user_id), item_id=str(item_id), item_name=item.name, item_type=item.item_type)
        return {"success": True, "item": {"id": str(item.id), "name": item.name, "is_equipped": True}, "message": "Item equipped successfully"}

    async def unequip_item(self, user_id: UUID, item_id: UUID) -> dict[str, Any]:
        """Unequip an item.

        Args:
            user_id: User UUID
            item_id: Item UUID to unequip

        Returns:
            Dict with success status and item info
        """
        row = await self.user_inventory_repo.find_with_item_for_update(user_id, item_id)
        if not row:
            raise AppException(status_code=404, error_code=ERROR_ITEM_NOT_OWNED, message="You don't own this item")

        inv, item = row
        inv.is_equipped = False

        if item.item_type == "clothes":
            profile = await self.profile_repo.find_by_id(user_id)
            if profile:
                profile.current_outfit = "default"

        await self.user_inventory_repo.commit()

        logger.info("Item unequipped", user_id=str(user_id), item_id=str(item_id), item_name=item.name, item_type=item.item_type)
        return {"success": True, "item": {"id": str(item.id), "name": item.name, "is_equipped": False}, "message": "Item unequipped successfully"}

    async def grant_item(
        self, user_id: UUID, item_id: UUID, source: str = "gift_reward",
    ) -> dict[str, Any]:
        """Grant an item to user for free (gift/reward).

        Args:
            user_id: User UUID
            item_id: Shop item UUID to grant
            source: Source of the grant

        Returns:
            Dict with success status, item info, and already_owned flag
        """
        item = await self.shop_item_repo.find_by_id(item_id)
        if not item:
            raise AppException(status_code=404, error_code=ERROR_ITEM_NOT_FOUND, message="Shop item not found")

        existing = await self.user_inventory_repo.find_ownership(user_id, item_id)
        if existing:
            logger.info("Item already owned, skip granting", user_id=str(user_id), item_id=str(item_id), item_name=item.name)
            return {"success": True, "already_owned": True, "item": {"id": str(item.id), "name": item.name, "item_type": item.item_type, "image_path": item.image_path, "rarity": item.rarity}, "message": "Item already owned"}

        inventory_item = UserInventory(user_id=user_id, item_id=item_id, is_equipped=False)
        await self.user_inventory_repo.create(inventory_item)
        await self.user_inventory_repo.commit()

        logger.info("Item granted to user", user_id=str(user_id), item_id=str(item_id), item_name=item.name, source=source)
        return {"success": True, "already_owned": False, "item": {"id": str(item.id), "name": item.name, "item_type": item.item_type, "image_path": item.image_path, "rarity": item.rarity}, "message": "Item granted successfully"}

    async def check_ownership(self, user_id: UUID, item_id: UUID) -> bool:
        """Check if user owns an item.

        Args:
            user_id: User UUID
            item_id: Item UUID

        Returns:
            True if user owns the item, False otherwise
        """
        result = await self.user_inventory_repo.find_ownership(user_id, item_id)
        return result is not None
