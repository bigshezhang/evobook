"""Quiz attempt repository for quiz results data access."""

from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.quiz_attempt import QuizAttempt
from app.domain.repositories.base import BaseRepository


class QuizAttemptRepository(BaseRepository[QuizAttempt]):
    """Repository for QuizAttempt entity data access."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize quiz attempt repository.

        Args:
            db: Async database session.
        """
        super().__init__(db, QuizAttempt)

    async def create(self, attempt: QuizAttempt) -> QuizAttempt:
        """Persist a new quiz attempt.

        Args:
            attempt: QuizAttempt entity.

        Returns:
            The saved attempt.
        """
        self.db.add(attempt)
        await self.db.flush()
        return attempt

    async def find_by_user_course_node(
        self,
        user_id: UUID,
        course_map_id: UUID,
        node_id: int,
    ) -> list[QuizAttempt]:
        """Find all attempts for a user's course map node.

        Args:
            user_id: User UUID.
            course_map_id: Course map UUID.
            node_id: Quiz node ID.

        Returns:
            List of QuizAttempt instances ordered by created_at desc.
        """
        stmt = (
            select(QuizAttempt)
            .where(
                QuizAttempt.user_id == user_id,
                QuizAttempt.course_map_id == course_map_id,
                QuizAttempt.node_id == node_id,
            )
            .order_by(desc(QuizAttempt.created_at))
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def find_by_id_and_user(
        self, attempt_id: UUID, user_id: UUID
    ) -> QuizAttempt | None:
        """Find a quiz attempt by ID and owner.

        Args:
            attempt_id: Quiz attempt UUID.
            user_id: User UUID.

        Returns:
            QuizAttempt instance or None.
        """
        stmt = select(QuizAttempt).where(
            QuizAttempt.id == attempt_id,
            QuizAttempt.user_id == user_id,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
