"""Discovery course repository for curated course data access."""

from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.discovery_course import DiscoveryCourse
from app.domain.repositories.base import BaseRepository


class DiscoveryCourseRepository(BaseRepository[DiscoveryCourse]):
    """Repository for DiscoveryCourse entity data access."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize discovery course repository.

        Args:
            db: Async database session.
        """
        super().__init__(db, DiscoveryCourse)

    async def find_active(
        self, category: str | None = None
    ) -> list[DiscoveryCourse]:
        """Find all active discovery courses with optional category filter.

        Args:
            category: Optional category filter.

        Returns:
            List of active DiscoveryCourse instances.
        """
        stmt = select(DiscoveryCourse).where(DiscoveryCourse.is_active == True)  # noqa: E712
        if category:
            stmt = stmt.where(DiscoveryCourse.category == category)
        stmt = stmt.order_by(
            DiscoveryCourse.category,
            DiscoveryCourse.display_order,
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def find_active_by_preset_id(
        self, preset_id: str
    ) -> DiscoveryCourse | None:
        """Find an active discovery course by preset ID.

        Args:
            preset_id: Preset identifier.

        Returns:
            DiscoveryCourse instance or None.
        """
        stmt = select(DiscoveryCourse).where(
            DiscoveryCourse.preset_id == preset_id,
            DiscoveryCourse.is_active == True,  # noqa: E712
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def increment_start_count(self, preset_id: str) -> None:
        """Increment the start_count for a discovery course.

        Args:
            preset_id: Preset identifier.
        """
        stmt = (
            update(DiscoveryCourse)
            .where(DiscoveryCourse.preset_id == preset_id)
            .values(start_count=DiscoveryCourse.start_count + 1)
        )
        await self.db.execute(stmt)
