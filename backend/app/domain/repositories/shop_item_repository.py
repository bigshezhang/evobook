"""Shop item repository for shop data access."""

from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.shop_item import ShopItem
from app.domain.models.user_inventory import UserInventory
from app.domain.repositories.base import BaseRepository


class ShopItemRepository(BaseRepository[ShopItem]):
    """Repository for ShopItem entity data access."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize shop item repository.

        Args:
            db: Async database session.
        """
        super().__init__(db, ShopItem)

    async def find_by_id(self, item_id: UUID) -> ShopItem | None:
        """Find a shop item by ID.

        Args:
            item_id: Shop item UUID.

        Returns:
            ShopItem instance or None.
        """
        stmt = select(ShopItem).where(ShopItem.id == item_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def find_all(
        self,
        item_type: str | None = None,
        rarity: str | None = None,
    ) -> list[ShopItem]:
        """Find all shop items with optional filters.

        Args:
            item_type: Optional filter by item type.
            rarity: Optional filter by rarity.

        Returns:
            List of ShopItem instances.
        """
        stmt = select(ShopItem)
        if item_type:
            stmt = stmt.where(ShopItem.item_type == item_type)
        if rarity:
            stmt = stmt.where(ShopItem.rarity == rarity)
        stmt = stmt.order_by(ShopItem.item_type, ShopItem.price)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def find_by_name(self, name: str) -> ShopItem | None:
        """Find a shop item by name.

        Args:
            name: Item name.

        Returns:
            ShopItem instance or None.
        """
        stmt = select(ShopItem).where(ShopItem.name == name)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def find_unowned_by_user(self, user_id: UUID) -> list[ShopItem]:
        """Find all non-default items that a user does not own.

        Args:
            user_id: User UUID.

        Returns:
            List of unowned ShopItem instances.
        """
        owned_subquery = (
            select(UserInventory.item_id)
            .where(UserInventory.user_id == user_id)
        )
        stmt = (
            select(ShopItem)
            .where(
                and_(
                    ShopItem.id.notin_(owned_subquery),
                    ShopItem.is_default == False,  # noqa: E712
                )
            )
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def save(self, item: ShopItem) -> ShopItem:
        """Persist a shop item.

        Args:
            item: ShopItem entity to save.

        Returns:
            The saved shop item.
        """
        self.db.add(item)
        return item
