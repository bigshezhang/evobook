"""Profile service for user profile CRUD operations.

This module provides business logic for retrieving and updating
user profiles linked to Supabase auth.users.
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.domain.models.course_map import CourseMap
from app.domain.models.profile import Profile

logger = get_logger(__name__)


class ProfileService:
    """Service for managing user profiles."""

    @staticmethod
    async def get_profile(user_id: UUID, db: AsyncSession) -> dict:
        """Get a user's profile.

        Args:
            user_id: The authenticated user's ID (from Supabase auth).
            db: Async database session.

        Returns:
            Dict with profile fields.

        Raises:
            NotFoundError: If profile does not exist.
        """
        stmt = select(Profile).where(Profile.id == user_id)
        result = await db.execute(stmt)
        profile = result.scalar_one_or_none()

        if profile is None:
            raise NotFoundError(resource="Profile", identifier=str(user_id))

        logger.info("Fetched profile", user_id=str(user_id))

        return {
            "id": str(profile.id),
            "display_name": profile.display_name,
            "mascot": profile.mascot,
            "onboarding_completed": profile.onboarding_completed,
            "gold_balance": profile.gold_balance,
            "dice_rolls_count": profile.dice_rolls_count,
            "level": profile.level,
            "current_exp": profile.current_exp,
            "current_outfit": profile.current_outfit,
            "travel_board_position": profile.travel_board_position,
            "created_at": profile.created_at.isoformat(),
            "updated_at": profile.updated_at.isoformat(),
        }

    @staticmethod
    async def update_profile(
        user_id: UUID,
        updates: dict,
        db: AsyncSession,
    ) -> dict:
        """Update a user's profile with provided fields.

        Only non-None fields in updates will be applied.

        Args:
            user_id: The authenticated user's ID.
            updates: Dict of fields to update (display_name, mascot, onboarding_completed).
            db: Async database session.

        Returns:
            Dict with the full updated profile.

        Raises:
            NotFoundError: If profile does not exist.
        """
        stmt = select(Profile).where(Profile.id == user_id)
        result = await db.execute(stmt)
        profile = result.scalar_one_or_none()

        if profile is None:
            raise NotFoundError(resource="Profile", identifier=str(user_id))

        # Apply only provided fields
        if "display_name" in updates:
            profile.display_name = updates["display_name"]
        if "mascot" in updates:
            profile.mascot = updates["mascot"]
        if "onboarding_completed" in updates:
            profile.onboarding_completed = updates["onboarding_completed"]

        profile.updated_at = datetime.now(timezone.utc)

        db.add(profile)
        await db.commit()
        await db.refresh(profile)

        logger.info(
            "Updated profile",
            user_id=str(user_id),
            updated_fields=list(updates.keys()),
        )

        return {
            "id": str(profile.id),
            "display_name": profile.display_name,
            "mascot": profile.mascot,
            "onboarding_completed": profile.onboarding_completed,
            "gold_balance": profile.gold_balance,
            "dice_rolls_count": profile.dice_rolls_count,
            "level": profile.level,
            "current_exp": profile.current_exp,
            "current_outfit": profile.current_outfit,
            "travel_board_position": profile.travel_board_position,
            "created_at": profile.created_at.isoformat(),
            "updated_at": profile.updated_at.isoformat(),
        }

    @staticmethod
    async def get_active_course_map_id(user_id: UUID, db: AsyncSession) -> UUID | None:
        """Get the active course map ID for a user.

        Priority:
        1. active_course_map_id (user-set)
        2. last_accessed_course_map_id (recently accessed)
        3. Most recently created course map

        Args:
            user_id: The authenticated user's ID.
            db: Async database session.

        Returns:
            Course map UUID or None if no courses exist.
        """
        # 获取用户 profile
        stmt = select(Profile).where(Profile.id == user_id)
        result = await db.execute(stmt)
        profile = result.scalar_one_or_none()

        if profile is None:
            logger.warning("Profile not found when getting active course", user_id=str(user_id))
            return None

        # 优先级 1: 用户设置的活跃课程
        if profile.active_course_map_id:
            logger.info(
                "Returning user-set active course",
                user_id=str(user_id),
                course_map_id=str(profile.active_course_map_id),
            )
            return profile.active_course_map_id

        # 优先级 2: 最后访问的课程
        if profile.last_accessed_course_map_id:
            logger.info(
                "Returning last accessed course",
                user_id=str(user_id),
                course_map_id=str(profile.last_accessed_course_map_id),
            )
            return profile.last_accessed_course_map_id

        # 优先级 3: 最新创建的课程
        stmt = (
            select(CourseMap.id)
            .where(CourseMap.user_id == user_id)
            .order_by(desc(CourseMap.created_at))
            .limit(1)
        )
        result = await db.execute(stmt)
        latest_course_id = result.scalar_one_or_none()

        if latest_course_id:
            logger.info(
                "Returning latest created course",
                user_id=str(user_id),
                course_map_id=str(latest_course_id),
            )
            return latest_course_id

        logger.info("No courses found for user", user_id=str(user_id))
        return None

    @staticmethod
    async def set_active_course_map(
        user_id: UUID,
        course_map_id: UUID,
        db: AsyncSession,
    ) -> None:
        """Set the active course map for a user.

        Args:
            user_id: The authenticated user's ID.
            course_map_id: The course map UUID to set as active.
            db: Async database session.

        Raises:
            NotFoundError: If profile does not exist.
        """
        stmt = select(Profile).where(Profile.id == user_id)
        result = await db.execute(stmt)
        profile = result.scalar_one_or_none()

        if profile is None:
            raise NotFoundError(resource="Profile", identifier=str(user_id))

        profile.active_course_map_id = course_map_id
        profile.updated_at = datetime.now(timezone.utc)

        db.add(profile)
        await db.commit()

        logger.info(
            "Set active course map",
            user_id=str(user_id),
            course_map_id=str(course_map_id),
        )

    @staticmethod
    async def update_last_accessed_course(
        user_id: UUID,
        course_map_id: UUID,
        db: AsyncSession,
    ) -> None:
        """Update the last accessed course map for a user.

        Args:
            user_id: The authenticated user's ID.
            course_map_id: The course map UUID that was accessed.
            db: Async database session.

        Raises:
            NotFoundError: If profile does not exist.
        """
        stmt = select(Profile).where(Profile.id == user_id)
        result = await db.execute(stmt)
        profile = result.scalar_one_or_none()

        if profile is None:
            raise NotFoundError(resource="Profile", identifier=str(user_id))

        profile.last_accessed_course_map_id = course_map_id
        profile.last_accessed_at = datetime.now(timezone.utc)
        profile.updated_at = datetime.now(timezone.utc)

        db.add(profile)
        await db.commit()

        logger.info(
            "Updated last accessed course",
            user_id=str(user_id),
            course_map_id=str(course_map_id),
        )
