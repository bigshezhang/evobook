"""Profile service for user profile CRUD operations.

This module provides business logic for retrieving and updating
user profiles linked to Supabase auth.users.
"""

from datetime import datetime, timezone
from uuid import UUID

from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.domain.repositories.profile_repository import ProfileRepository

logger = get_logger(__name__)


class ProfileService:
    """Service for managing user profiles."""

    def __init__(self, profile_repo: ProfileRepository) -> None:
        """Initialize profile service.

        Args:
            profile_repo: Profile repository for data access.
        """
        self.profile_repo = profile_repo

    async def get_profile(self, user_id: UUID) -> dict:
        """Get a user's profile.

        Args:
            user_id: The authenticated user's ID (from Supabase auth).

        Returns:
            Dict with profile fields.

        Raises:
            NotFoundError: If profile does not exist.
        """
        profile = await self.profile_repo.find_by_id(user_id)

        if profile is None:
            raise NotFoundError(resource="Profile", identifier=str(user_id))

        logger.info("Fetched profile", user_id=str(user_id))

        return {
            "id": str(profile.id),
            "email": profile.email,
            "display_name": profile.display_name,
            "mascot": profile.mascot,
            "onboarding_completed": profile.onboarding_completed,
            "guides_completed": profile.guides_completed or [],
            "gold_balance": profile.gold_balance,
            "dice_rolls_count": profile.dice_rolls_count,
            "level": profile.level,
            "current_exp": profile.current_exp,
            "current_outfit": profile.current_outfit,
            "travel_board_position": profile.travel_board_position,
            "created_at": profile.created_at.isoformat(),
            "updated_at": profile.updated_at.isoformat(),
        }

    async def update_profile(
        self,
        user_id: UUID,
        updates: dict,
    ) -> dict:
        """Update a user's profile with provided fields.

        Only non-None fields in updates will be applied.

        Args:
            user_id: The authenticated user's ID.
            updates: Dict of fields to update (display_name, mascot, onboarding_completed).

        Returns:
            Dict with the full updated profile.

        Raises:
            NotFoundError: If profile does not exist.
        """
        profile = await self.profile_repo.find_by_id(user_id)

        if profile is None:
            raise NotFoundError(resource="Profile", identifier=str(user_id))

        # Apply only provided fields
        if "display_name" in updates:
            profile.display_name = updates["display_name"]
        if "mascot" in updates:
            profile.mascot = updates["mascot"]
        if "onboarding_completed" in updates:
            profile.onboarding_completed = updates["onboarding_completed"]
        if "guides_completed" in updates:
            profile.guides_completed = updates["guides_completed"]

        profile.updated_at = datetime.now(timezone.utc)

        await self.profile_repo.save(profile)
        await self.profile_repo.commit()
        await self.profile_repo.refresh(profile)

        logger.info(
            "Updated profile",
            user_id=str(user_id),
            updated_fields=list(updates.keys()),
        )

        return {
            "id": str(profile.id),
            "email": profile.email,
            "display_name": profile.display_name,
            "mascot": profile.mascot,
            "onboarding_completed": profile.onboarding_completed,
            "guides_completed": profile.guides_completed or [],
            "gold_balance": profile.gold_balance,
            "dice_rolls_count": profile.dice_rolls_count,
            "level": profile.level,
            "current_exp": profile.current_exp,
            "current_outfit": profile.current_outfit,
            "travel_board_position": profile.travel_board_position,
            "created_at": profile.created_at.isoformat(),
            "updated_at": profile.updated_at.isoformat(),
        }

    async def get_active_course_map_id(self, user_id: UUID) -> UUID | None:
        """Get the active course map ID for a user.

        Priority:
        1. active_course_map_id (user-set)
        2. last_accessed_course_map_id (recently accessed)
        3. Most recently created course map

        Args:
            user_id: The authenticated user's ID.

        Returns:
            Course map UUID or None if no courses exist.
        """
        profile = await self.profile_repo.find_by_id(user_id)

        if profile is None:
            logger.warning("Profile not found when getting active course", user_id=str(user_id))
            return None

        # Priority 1: user-set active course
        if profile.active_course_map_id:
            logger.info(
                "Returning user-set active course",
                user_id=str(user_id),
                course_map_id=str(profile.active_course_map_id),
            )
            return profile.active_course_map_id

        # Priority 2: last accessed course
        if profile.last_accessed_course_map_id:
            logger.info(
                "Returning last accessed course",
                user_id=str(user_id),
                course_map_id=str(profile.last_accessed_course_map_id),
            )
            return profile.last_accessed_course_map_id

        # Priority 3: latest created course
        latest_course_id = await self.profile_repo.find_latest_course_map_id(user_id)

        if latest_course_id:
            logger.info(
                "Returning latest created course",
                user_id=str(user_id),
                course_map_id=str(latest_course_id),
            )
            return latest_course_id

        logger.info("No courses found for user", user_id=str(user_id))
        return None

    async def set_active_course_map(
        self,
        user_id: UUID,
        course_map_id: UUID,
    ) -> None:
        """Set the active course map for a user.

        Args:
            user_id: The authenticated user's ID.
            course_map_id: The course map UUID to set as active.

        Raises:
            NotFoundError: If profile does not exist.
        """
        profile = await self.profile_repo.find_by_id(user_id)

        if profile is None:
            raise NotFoundError(resource="Profile", identifier=str(user_id))

        profile.active_course_map_id = course_map_id
        profile.updated_at = datetime.now(timezone.utc)

        await self.profile_repo.save(profile)
        await self.profile_repo.commit()

        logger.info(
            "Set active course map",
            user_id=str(user_id),
            course_map_id=str(course_map_id),
        )

    async def update_last_accessed_course(
        self,
        user_id: UUID,
        course_map_id: UUID,
    ) -> None:
        """Update the last accessed course map for a user.

        Args:
            user_id: The authenticated user's ID.
            course_map_id: The course map UUID that was accessed.

        Raises:
            NotFoundError: If profile does not exist.
        """
        profile = await self.profile_repo.find_by_id(user_id)

        if profile is None:
            raise NotFoundError(resource="Profile", identifier=str(user_id))

        profile.last_accessed_course_map_id = course_map_id
        profile.last_accessed_at = datetime.now(timezone.utc)
        profile.updated_at = datetime.now(timezone.utc)

        await self.profile_repo.save(profile)
        await self.profile_repo.commit()

        logger.info(
            "Updated last accessed course",
            user_id=str(user_id),
            course_map_id=str(course_map_id),
        )
