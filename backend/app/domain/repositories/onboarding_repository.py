"""Onboarding session repository for session state persistence."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.onboarding import OnboardingSession
from app.domain.repositories.base import BaseRepository


class OnboardingRepository(BaseRepository[OnboardingSession]):
    """Repository for OnboardingSession entity data access."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize onboarding repository.

        Args:
            db: Async database session.
        """
        super().__init__(db, OnboardingSession)

    async def find_by_id(self, session_id: UUID) -> OnboardingSession | None:
        """Find an onboarding session by its ID.

        Args:
            session_id: Session UUID.

        Returns:
            OnboardingSession instance or None.
        """
        stmt = select(OnboardingSession).where(OnboardingSession.id == session_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def save(self, session: OnboardingSession) -> OnboardingSession:
        """Persist an onboarding session.

        Args:
            session: OnboardingSession entity to save.

        Returns:
            The saved session.
        """
        self.db.add(session)
        return session
