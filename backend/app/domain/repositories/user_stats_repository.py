"""User stats repository for learning metrics data access."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.user_stats import UserStats
from app.domain.repositories.base import BaseRepository


class UserStatsRepository(BaseRepository[UserStats]):
    """Repository for UserStats entity data access."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize user stats repository.

        Args:
            db: Async database session.
        """
        super().__init__(db, UserStats)

    async def find_by_user_id(self, user_id: UUID) -> UserStats | None:
        """Find user stats by user ID.

        Args:
            user_id: User UUID.

        Returns:
            UserStats instance or None.
        """
        stmt = select(UserStats).where(UserStats.user_id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert_add_study_seconds(
        self, user_id: UUID, seconds: int, now: datetime
    ) -> None:
        """Atomically add study seconds via upsert.

        Args:
            user_id: User UUID.
            seconds: Seconds to add.
            now: Current timestamp.
        """
        stmt = pg_insert(UserStats).values(
            user_id=user_id,
            total_study_seconds=seconds,
            completed_courses_count=0,
            mastered_nodes_count=0,
            updated_at=now,
        )
        stmt = stmt.on_conflict_do_update(
            constraint="user_stats_pkey",
            set_={
                "total_study_seconds": UserStats.total_study_seconds + seconds,
                "updated_at": now,
            },
        )
        await self.db.execute(stmt)

    async def upsert_increment_completed_courses(
        self, user_id: UUID, now: datetime
    ) -> None:
        """Atomically increment completed courses count via upsert.

        Args:
            user_id: User UUID.
            now: Current timestamp.
        """
        stmt = pg_insert(UserStats).values(
            user_id=user_id,
            total_study_seconds=0,
            completed_courses_count=1,
            mastered_nodes_count=0,
            updated_at=now,
        )
        stmt = stmt.on_conflict_do_update(
            constraint="user_stats_pkey",
            set_={
                "completed_courses_count": UserStats.completed_courses_count + 1,
                "updated_at": now,
            },
        )
        await self.db.execute(stmt)

    async def upsert_increment_mastered_nodes(
        self, user_id: UUID, now: datetime
    ) -> None:
        """Atomically increment mastered nodes count via upsert.

        Args:
            user_id: User UUID.
            now: Current timestamp.
        """
        stmt = pg_insert(UserStats).values(
            user_id=user_id,
            total_study_seconds=0,
            completed_courses_count=0,
            mastered_nodes_count=1,
            updated_at=now,
        )
        stmt = stmt.on_conflict_do_update(
            constraint="user_stats_pkey",
            set_={
                "mastered_nodes_count": UserStats.mastered_nodes_count + 1,
                "updated_at": now,
            },
        )
        await self.db.execute(stmt)

    async def count_total_users(self) -> int:
        """Count total users with stats records.

        Returns:
            Total number of users with stats.
        """
        stmt = select(func.count()).select_from(UserStats)
        result = await self.db.execute(stmt)
        return result.scalar() or 0

    async def count_users_ahead(self, study_seconds: int) -> int:
        """Count users with more study time than the given amount.

        Args:
            study_seconds: Study time threshold.

        Returns:
            Number of users with greater study time.
        """
        stmt = select(func.count()).select_from(UserStats).where(
            UserStats.total_study_seconds > study_seconds
        )
        result = await self.db.execute(stmt)
        return result.scalar() or 0
