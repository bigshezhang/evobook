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
        exclude_drafts: bool = False,
    ) -> list[QuizAttempt]:
        """Find all attempts for a user's course map node.

        Args:
            user_id: User UUID.
            course_map_id: Course map UUID.
            node_id: Quiz node ID.
            exclude_drafts: If True, only return completed attempts (score IS NOT NULL).

        Returns:
            List of QuizAttempt instances ordered by created_at desc.
        """
        conditions = [
            QuizAttempt.user_id == user_id,
            QuizAttempt.course_map_id == course_map_id,
            QuizAttempt.node_id == node_id,
        ]
        if exclude_drafts:
            conditions.append(QuizAttempt.score.is_not(None))
        stmt = (
            select(QuizAttempt)
            .where(*conditions)
            .order_by(desc(QuizAttempt.created_at))
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def find_draft_by_user_course_node(
        self,
        user_id: UUID,
        course_map_id: UUID,
        node_id: int,
    ) -> QuizAttempt | None:
        """Find the latest draft (in-progress, score is null) for a user's node.

        Args:
            user_id: User UUID.
            course_map_id: Course map UUID.
            node_id: Quiz node ID.

        Returns:
            The draft QuizAttempt or None.
        """
        stmt = (
            select(QuizAttempt)
            .where(
                QuizAttempt.user_id == user_id,
                QuizAttempt.course_map_id == course_map_id,
                QuizAttempt.node_id == node_id,
                QuizAttempt.score.is_(None),  # draft: score not yet set
            )
            .order_by(desc(QuizAttempt.created_at))
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

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
