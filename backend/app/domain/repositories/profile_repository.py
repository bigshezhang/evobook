"""Profile repository for user profile data access."""

from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.course_map import CourseMap
from app.domain.models.profile import Profile
from app.domain.repositories.base import BaseRepository


class ProfileRepository(BaseRepository[Profile]):
    """Repository for Profile entity data access."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize profile repository.

        Args:
            db: Async database session.
        """
        super().__init__(db, Profile)

    async def find_by_id(self, user_id: UUID) -> Profile | None:
        """Find a profile by user ID (primary key).

        Args:
            user_id: User UUID (matches Supabase auth.users.id).

        Returns:
            Profile instance or None.
        """
        stmt = select(Profile).where(Profile.id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def find_by_id_for_update(self, user_id: UUID) -> Profile | None:
        """Find a profile by user ID with row-level lock.

        Args:
            user_id: User UUID.

        Returns:
            Profile instance or None.
        """
        stmt = select(Profile).where(Profile.id == user_id).with_for_update()
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def save(self, profile: Profile) -> Profile:
        """Persist a profile (add to session).

        Args:
            profile: Profile entity to save.

        Returns:
            The saved profile.
        """
        self.db.add(profile)
        return profile

    async def find_latest_course_map_id(self, user_id: UUID) -> UUID | None:
        """Find the most recently created course map ID for a user.

        Args:
            user_id: User UUID.

        Returns:
            Course map UUID or None if no courses exist.
        """
        stmt = (
            select(CourseMap.id)
            .where(CourseMap.user_id == user_id)
            .order_by(desc(CourseMap.created_at))
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
