"""Inventory service for managing user-owned items."""

from typing import Any
from uuid import UUID

from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.error_codes import ERROR_ITEM_NOT_FOUND, ERROR_ITEM_NOT_OWNED
from app.core.exceptions import AppException
from app.core.logging import get_logger
from app.domain.models.profile import Profile
from app.domain.models.shop_item import ShopItem
from app.domain.models.user_inventory import UserInventory

logger = get_logger(__name__)


class InventoryService:
    """Service for user inventory management."""

    @staticmethod
    async def get_user_inventory(
        user_id: UUID,
        db: AsyncSession,
        item_type: str | None = None,
        equipped_only: bool = False,
    ) -> dict[str, Any]:
        """Get user's inventory.

        Args:
            user_id: User UUID
            db: Database session
            item_type: Optional filter by item type
            equipped_only: If True, only return equipped items

        Returns:
            Dict containing inventory items and total count
        """
        # Build query with join to get item details
        stmt = (
            select(UserInventory, ShopItem)
            .join(ShopItem, UserInventory.item_id == ShopItem.id)
            .where(UserInventory.user_id == user_id)
        )

        if item_type:
            stmt = stmt.where(ShopItem.item_type == item_type)
        if equipped_only:
            stmt = stmt.where(UserInventory.is_equipped == True)

        stmt = stmt.order_by(UserInventory.purchased_at.desc())

        result = await db.execute(stmt)
        rows = result.all()

        # Build inventory response
        inventory_data = []
        for inv, item in rows:
            inventory_data.append({
                "item_id": str(inv.item_id),
                "name": item.name,
                "item_type": item.item_type,
                "image_path": item.image_path,
                "is_equipped": inv.is_equipped,
                "purchased_at": inv.purchased_at.isoformat(),
            })

        logger.info(
            "User inventory retrieved",
            user_id=str(user_id),
            total_items=len(inventory_data),
            item_type=item_type,
            equipped_only=equipped_only,
        )

        return {
            "inventory": inventory_data,
            "total": len(inventory_data),
        }

    @staticmethod
    async def equip_item(
        user_id: UUID,
        item_id: UUID,
        db: AsyncSession,
    ) -> dict[str, Any]:
        """Equip an item.

        For clothes: automatically unequips other clothes.
        For furniture: can equip multiple.

        Args:
            user_id: User UUID
            item_id: Item UUID to equip
            db: Database session

        Returns:
            Dict with success status and item info

        Raises:
            AppException: If item not owned or not found
        """
        # Get inventory item with shop item details
        inv_stmt = (
            select(UserInventory, ShopItem)
            .join(ShopItem, UserInventory.item_id == ShopItem.id)
            .where(
                and_(
                    UserInventory.user_id == user_id,
                    UserInventory.item_id == item_id,
                )
            )
            .with_for_update()
        )
        inv_result = await db.execute(inv_stmt)
        row = inv_result.one_or_none()

        if not row:
            raise AppException(
                status_code=404,
                error_code=ERROR_ITEM_NOT_OWNED,
                message="You don't own this item",
            )

        inv, item = row

        # If already equipped, no-op
        if inv.is_equipped:
            return {
                "success": True,
                "item": {
                    "id": str(item.id),
                    "name": item.name,
                    "is_equipped": True,
                },
                "message": "Item is already equipped",
            }

        # If clothes, unequip all other clothes
        if item.item_type == "clothes":
            # Unequip all other clothes
            unequip_stmt = (
                update(UserInventory)
                .where(
                    and_(
                        UserInventory.user_id == user_id,
                        UserInventory.item_id.in_(
                            select(ShopItem.id).where(ShopItem.item_type == "clothes")
                        ),
                    )
                )
                .values(is_equipped=False)
            )
            await db.execute(unequip_stmt)

            # Update profile current_outfit
            profile_stmt = select(Profile).where(Profile.id == user_id)
            profile_result = await db.execute(profile_stmt)
            profile = profile_result.scalar_one_or_none()

            if profile:
                profile.current_outfit = item.name

        # Equip the item
        inv.is_equipped = True

        await db.commit()

        logger.info(
            "Item equipped",
            user_id=str(user_id),
            item_id=str(item_id),
            item_name=item.name,
            item_type=item.item_type,
        )

        return {
            "success": True,
            "item": {
                "id": str(item.id),
                "name": item.name,
                "is_equipped": True,
            },
            "message": "Item equipped successfully",
        }

    @staticmethod
    async def unequip_item(
        user_id: UUID,
        item_id: UUID,
        db: AsyncSession,
    ) -> dict[str, Any]:
        """Unequip an item.

        Args:
            user_id: User UUID
            item_id: Item UUID to unequip
            db: Database session

        Returns:
            Dict with success status and item info

        Raises:
            AppException: If item not owned or not found
        """
        # Get inventory item with shop item details
        inv_stmt = (
            select(UserInventory, ShopItem)
            .join(ShopItem, UserInventory.item_id == ShopItem.id)
            .where(
                and_(
                    UserInventory.user_id == user_id,
                    UserInventory.item_id == item_id,
                )
            )
            .with_for_update()
        )
        inv_result = await db.execute(inv_stmt)
        row = inv_result.one_or_none()

        if not row:
            raise AppException(
                status_code=404,
                error_code=ERROR_ITEM_NOT_OWNED,
                message="You don't own this item",
            )

        inv, item = row

        # Unequip
        inv.is_equipped = False

        # If clothes, reset profile outfit to default
        if item.item_type == "clothes":
            profile_stmt = select(Profile).where(Profile.id == user_id)
            profile_result = await db.execute(profile_stmt)
            profile = profile_result.scalar_one_or_none()

            if profile:
                profile.current_outfit = "default"

        await db.commit()

        logger.info(
            "Item unequipped",
            user_id=str(user_id),
            item_id=str(item_id),
            item_name=item.name,
            item_type=item.item_type,
        )

        return {
            "success": True,
            "item": {
                "id": str(item.id),
                "name": item.name,
                "is_equipped": False,
            },
            "message": "Item unequipped successfully",
        }

    @staticmethod
    async def grant_item(
        user_id: UUID,
        item_id: UUID,
        db: AsyncSession,
        source: str = "gift_reward",
    ) -> dict[str, Any]:
        """Grant an item to user for free (gift/reward).

        If the user already owns the item, returns success with already_owned=True.

        Args:
            user_id: User UUID
            item_id: Shop item UUID to grant
            db: Database session
            source: Source of the grant (e.g., 'tile_gift', 'event_reward')

        Returns:
            Dict with success status, item info, and already_owned flag

        Raises:
            AppException: If item not found in shop
        """
        # Get item details
        item_stmt = select(ShopItem).where(ShopItem.id == item_id)
        item_result = await db.execute(item_stmt)
        item = item_result.scalar_one_or_none()

        if not item:
            raise AppException(
                status_code=404,
                error_code=ERROR_ITEM_NOT_FOUND,
                message="Shop item not found",
            )

        # Check if already owned
        ownership_stmt = select(UserInventory).where(
            and_(
                UserInventory.user_id == user_id,
                UserInventory.item_id == item_id,
            )
        )
        ownership_result = await db.execute(ownership_stmt)
        existing = ownership_result.scalar_one_or_none()

        if existing:
            logger.info(
                "Item already owned, skip granting",
                user_id=str(user_id),
                item_id=str(item_id),
                item_name=item.name,
            )
            return {
                "success": True,
                "already_owned": True,
                "item": {
                    "id": str(item.id),
                    "name": item.name,
                    "item_type": item.item_type,
                    "image_path": item.image_path,
                    "rarity": item.rarity,
                },
                "message": "Item already owned",
            }

        # Add to inventory
        inventory_item = UserInventory(
            user_id=user_id,
            item_id=item_id,
            is_equipped=False,
        )
        db.add(inventory_item)

        await db.commit()

        logger.info(
            "Item granted to user",
            user_id=str(user_id),
            item_id=str(item_id),
            item_name=item.name,
            source=source,
        )

        return {
            "success": True,
            "already_owned": False,
            "item": {
                "id": str(item.id),
                "name": item.name,
                "item_type": item.item_type,
                "image_path": item.image_path,
                "rarity": item.rarity,
            },
            "message": "Item granted successfully",
        }

    @staticmethod
    async def check_ownership(
        user_id: UUID,
        item_id: UUID,
        db: AsyncSession,
    ) -> bool:
        """Check if user owns an item.

        Args:
            user_id: User UUID
            item_id: Item UUID
            db: Database session

        Returns:
            True if user owns the item, False otherwise
        """
        stmt = select(UserInventory).where(
            and_(
                UserInventory.user_id == user_id,
                UserInventory.item_id == item_id,
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none() is not None
