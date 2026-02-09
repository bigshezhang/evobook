"""Learning activity repository for activity tracking data access."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.learning_activity import LearningActivity
from app.domain.repositories.base import BaseRepository


class LearningActivityRepository(BaseRepository[LearningActivity]):
    """Repository for LearningActivity entity data access."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize learning activity repository.

        Args:
            db: Async database session.
        """
        super().__init__(db, LearningActivity)

    async def find_by_user_since(
        self, user_id: UUID, cutoff_date: datetime
    ) -> list[LearningActivity]:
        """Find activities for a user since a cutoff date.

        Args:
            user_id: User UUID.
            cutoff_date: Earliest date to include.

        Returns:
            List of activities ordered by completed_at desc.
        """
        stmt = (
            select(LearningActivity)
            .where(
                LearningActivity.user_id == user_id,
                LearningActivity.completed_at >= cutoff_date,
            )
            .order_by(LearningActivity.completed_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def find_by_user_and_course(
        self, user_id: UUID, course_map_id: UUID
    ) -> list[LearningActivity]:
        """Find all activities for a user's course map.

        Args:
            user_id: User UUID.
            course_map_id: Course map UUID.

        Returns:
            List of activities ordered by completed_at desc.
        """
        stmt = (
            select(LearningActivity)
            .where(
                LearningActivity.user_id == user_id,
                LearningActivity.course_map_id == course_map_id,
            )
            .order_by(LearningActivity.completed_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def find_completed_node_ids(
        self, user_id: UUID, course_map_id: UUID
    ) -> set[int]:
        """Find all completed node IDs for a user's course map.

        Args:
            user_id: User UUID.
            course_map_id: Course map UUID.

        Returns:
            Set of completed node IDs.
        """
        stmt = select(LearningActivity.node_id).where(
            LearningActivity.user_id == user_id,
            LearningActivity.course_map_id == course_map_id,
            LearningActivity.activity_type == "node_completed",
        ).distinct()
        result = await self.db.execute(stmt)
        return {row[0] for row in result.fetchall()}

    async def find_course_completion_marker(
        self, user_id: UUID, course_map_id: UUID
    ) -> LearningActivity | None:
        """Find the course completion marker activity.

        Args:
            user_id: User UUID.
            course_map_id: Course map UUID.

        Returns:
            LearningActivity instance or None.
        """
        stmt = select(LearningActivity).where(
            LearningActivity.user_id == user_id,
            LearningActivity.course_map_id == course_map_id,
            LearningActivity.activity_type == "course_completed",
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def find_node_in_progress(
        self, user_id: UUID, course_map_id: UUID, node_id: int
    ) -> LearningActivity | None:
        """Find the node_in_progress activity for accumulated time tracking.

        Args:
            user_id: User UUID.
            course_map_id: Course map UUID.
            node_id: Node ID.

        Returns:
            LearningActivity instance or None.
        """
        stmt = select(LearningActivity).where(
            LearningActivity.user_id == user_id,
            LearningActivity.course_map_id == course_map_id,
            LearningActivity.node_id == node_id,
            LearningActivity.activity_type == "node_in_progress",
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, activity: LearningActivity) -> LearningActivity:
        """Add a new learning activity to the session.

        Args:
            activity: LearningActivity entity to persist.

        Returns:
            The added activity.
        """
        self.db.add(activity)
        await self.db.flush()
        return activity
