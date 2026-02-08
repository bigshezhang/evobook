"""User inventory repository for owned items data access."""

from typing import Any
from uuid import UUID

from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.shop_item import ShopItem
from app.domain.models.user_inventory import UserInventory
from app.domain.repositories.base import BaseRepository


class UserInventoryRepository(BaseRepository[UserInventory]):
    """Repository for UserInventory entity data access."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize user inventory repository.

        Args:
            db: Async database session.
        """
        super().__init__(db, UserInventory)

    async def find_by_user(
        self,
        user_id: UUID,
        item_type: str | None = None,
        equipped_only: bool = False,
    ) -> list[tuple[UserInventory, ShopItem]]:
        """Find user inventory with item details.

        Args:
            user_id: User UUID.
            item_type: Optional filter by item type.
            equipped_only: If True, only return equipped items.

        Returns:
            List of (UserInventory, ShopItem) tuples.
        """
        stmt = (
            select(UserInventory, ShopItem)
            .join(ShopItem, UserInventory.item_id == ShopItem.id)
            .where(UserInventory.user_id == user_id)
        )
        if item_type:
            stmt = stmt.where(ShopItem.item_type == item_type)
        if equipped_only:
            stmt = stmt.where(UserInventory.is_equipped == True)  # noqa: E712
        stmt = stmt.order_by(UserInventory.purchased_at.desc())
        result = await self.db.execute(stmt)
        return list(result.all())

    async def find_all_by_user(self, user_id: UUID) -> list[UserInventory]:
        """Find all inventory records for a user (without item join).

        Args:
            user_id: User UUID.

        Returns:
            List of UserInventory instances.
        """
        stmt = select(UserInventory).where(UserInventory.user_id == user_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def find_ownership(
        self, user_id: UUID, item_id: UUID
    ) -> UserInventory | None:
        """Check if a user owns a specific item.

        Args:
            user_id: User UUID.
            item_id: Item UUID.

        Returns:
            UserInventory instance or None.
        """
        stmt = select(UserInventory).where(
            and_(
                UserInventory.user_id == user_id,
                UserInventory.item_id == item_id,
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def find_ownership_for_update(
        self, user_id: UUID, item_id: UUID
    ) -> UserInventory | None:
        """Check ownership with row-level lock.

        Args:
            user_id: User UUID.
            item_id: Item UUID.

        Returns:
            UserInventory instance or None.
        """
        stmt = (
            select(UserInventory)
            .where(
                and_(
                    UserInventory.user_id == user_id,
                    UserInventory.item_id == item_id,
                )
            )
            .with_for_update()
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def find_with_item_for_update(
        self, user_id: UUID, item_id: UUID
    ) -> tuple[UserInventory, ShopItem] | None:
        """Find inventory record with item details and row-level lock.

        Args:
            user_id: User UUID.
            item_id: Item UUID.

        Returns:
            Tuple of (UserInventory, ShopItem) or None.
        """
        stmt = (
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
        result = await self.db.execute(stmt)
        return result.one_or_none()

    async def unequip_all_clothes(self, user_id: UUID) -> None:
        """Unequip all clothes items for a user.

        Args:
            user_id: User UUID.
        """
        stmt = (
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
        await self.db.execute(stmt)

    async def create(self, inventory_item: UserInventory) -> UserInventory:
        """Add a new inventory record.

        Args:
            inventory_item: UserInventory entity to persist.

        Returns:
            The added inventory record.
        """
        self.db.add(inventory_item)
        return inventory_item
