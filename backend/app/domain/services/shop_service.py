"""Shop service for managing shop items and purchases."""

from typing import Any
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.error_codes import (
    ERROR_INSUFFICIENT_GOLD,
    ERROR_ITEM_NOT_FOUND,
    ERROR_PROFILE_NOT_FOUND,
)
from app.core.exceptions import AppException
from app.core.logging import get_logger
from app.domain.models.game_transaction import GameTransaction
from app.domain.models.profile import Profile
from app.domain.models.shop_item import ShopItem
from app.domain.models.user_inventory import UserInventory

logger = get_logger(__name__)


class ShopService:
    """Service for shop item management and purchases."""

    @staticmethod
    async def get_shop_items(
        user_id: UUID,
        db: AsyncSession,
        item_type: str | None = None,
        rarity: str | None = None,
    ) -> dict[str, Any]:
        """Get shop items with user ownership status.

        Args:
            user_id: User UUID
            db: Database session
            item_type: Optional filter by item type ('clothes', 'furniture')
            rarity: Optional filter by rarity

        Returns:
            Dict containing items list and total count
        """
        # Build query
        stmt = select(ShopItem)

        if item_type:
            stmt = stmt.where(ShopItem.item_type == item_type)
        if rarity:
            stmt = stmt.where(ShopItem.rarity == rarity)

        stmt = stmt.order_by(ShopItem.item_type, ShopItem.price)

        result = await db.execute(stmt)
        shop_items = result.scalars().all()

        # Get user's owned items
        owned_stmt = select(UserInventory).where(UserInventory.user_id == user_id)
        owned_result = await db.execute(owned_stmt)
        owned_items = owned_result.scalars().all()

        # Create lookup for owned items
        owned_item_ids = {inv.item_id for inv in owned_items}
        equipped_item_ids = {inv.item_id for inv in owned_items if inv.is_equipped}

        # Build response
        items_data = []
        for item in shop_items:
            items_data.append({
                "id": str(item.id),
                "name": item.name,
                "item_type": item.item_type,
                "price": item.price,
                "image_path": item.image_path,
                "rarity": item.rarity,
                "owned": item.id in owned_item_ids,
                "is_equipped": item.id in equipped_item_ids,
            })

        logger.info(
            "Shop items retrieved",
            user_id=str(user_id),
            total_items=len(items_data),
            item_type=item_type,
            rarity=rarity,
        )

        return {
            "items": items_data,
            "total": len(items_data),
        }

    @staticmethod
    async def purchase_item(
        user_id: UUID,
        item_id: UUID,
        db: AsyncSession,
    ) -> dict[str, Any]:
        """Purchase a shop item.

        Args:
            user_id: User UUID
            item_id: Shop item UUID
            db: Database session

        Returns:
            Dict containing success status, item info, and remaining gold

        Raises:
            AppException: If item not found, already owned, or insufficient gold
        """
        # Get item
        item_stmt = select(ShopItem).where(ShopItem.id == item_id)
        item_result = await db.execute(item_stmt)
        item = item_result.scalar_one_or_none()

        if not item:
            raise AppException(
                status_code=404,
                error_code=ERROR_ITEM_NOT_FOUND,
                message="Shop item not found",
            )

        # Check if already owned (use SELECT FOR UPDATE to prevent race conditions)
        ownership_stmt = (
            select(UserInventory)
            .where(
                and_(
                    UserInventory.user_id == user_id,
                    UserInventory.item_id == item_id,
                )
            )
            .with_for_update()
        )
        ownership_result = await db.execute(ownership_stmt)
        existing_ownership = ownership_result.scalar_one_or_none()

        if existing_ownership:
            raise AppException(
                status_code=400,
                error_code="ALREADY_OWNED",  # Not in error_codes yet, kept as is
                message="You already own this item",
            )

        # Get user profile (with lock)
        profile_stmt = select(Profile).where(Profile.id == user_id).with_for_update()
        profile_result = await db.execute(profile_stmt)
        profile = profile_result.scalar_one_or_none()

        if not profile:
            raise AppException(
                status_code=404,
                error_code=ERROR_PROFILE_NOT_FOUND,
                message="User profile not found",
            )

        # Check gold balance
        if profile.gold_balance < item.price:
            raise AppException(
                status_code=400,
                error_code=ERROR_INSUFFICIENT_GOLD,
                message=f"Insufficient gold. Required: {item.price}, Available: {profile.gold_balance}",
            )

        # Deduct gold
        profile.gold_balance -= item.price

        # Add to inventory
        inventory_item = UserInventory(
            user_id=user_id,
            item_id=item_id,
            is_equipped=False,
        )
        db.add(inventory_item)

        # Record transaction
        transaction = GameTransaction(
            user_id=user_id,
            transaction_type="spend_gold",
            amount=-item.price,
            source="shop_purchase",
            source_detail={
                "item_id": str(item_id),
                "item_name": item.name,
                "item_type": item.item_type,
            },
        )
        db.add(transaction)

        await db.commit()
        await db.refresh(profile)

        logger.info(
            "Item purchased",
            user_id=str(user_id),
            item_id=str(item_id),
            item_name=item.name,
            price=item.price,
            gold_remaining=profile.gold_balance,
        )

        return {
            "success": True,
            "item": {
                "id": str(item.id),
                "name": item.name,
                "price": item.price,
            },
            "gold_remaining": profile.gold_balance,
            "message": "Item purchased successfully",
        }

    @staticmethod
    async def seed_initial_items(
        db: AsyncSession,
        items_data: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Seed initial shop items (idempotent).

        Args:
            db: Database session
            items_data: List of item dictionaries

        Returns:
            Dict with success status and count
        """
        created_count = 0
        skipped_count = 0

        for item_data in items_data:
            # Check if item already exists by name
            stmt = select(ShopItem).where(ShopItem.name == item_data["name"])
            result = await db.execute(stmt)
            existing = result.scalar_one_or_none()

            if existing:
                skipped_count += 1
                continue

            # Create item
            item = ShopItem(
                name=item_data["name"],
                item_type=item_data["item_type"],
                price=item_data["price"],
                image_path=item_data["image_path"],
                rarity=item_data.get("rarity", "common"),
                is_default=item_data.get("is_default", False),
            )
            db.add(item)
            created_count += 1

        await db.commit()

        logger.info(
            "Shop items seeded",
            created_count=created_count,
            skipped_count=skipped_count,
        )

        return {
            "success": True,
            "created": created_count,
            "skipped": skipped_count,
            "total": len(items_data),
        }
