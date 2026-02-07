"""Profile service for user profile CRUD operations.

This module provides business logic for retrieving and updating
user profiles linked to Supabase auth.users.
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
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
            "created_at": profile.created_at.isoformat(),
            "updated_at": profile.updated_at.isoformat(),
        }
