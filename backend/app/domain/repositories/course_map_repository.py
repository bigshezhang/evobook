"""Course map repository for DAG data access."""

from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.course_map import CourseMap
from app.domain.models.node_progress import NodeProgress
from app.domain.repositories.base import BaseRepository


class CourseMapRepository(BaseRepository[CourseMap]):
    """Repository for CourseMap entity data access."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize course map repository.

        Args:
            db: Async database session.
        """
        super().__init__(db, CourseMap)

    async def find_by_id(self, course_map_id: UUID) -> CourseMap | None:
        """Find a course map by ID.

        Args:
            course_map_id: Course map UUID.

        Returns:
            CourseMap instance or None.
        """
        stmt = select(CourseMap).where(CourseMap.id == course_map_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def find_by_id_and_user(
        self, course_map_id: UUID, user_id: UUID
    ) -> CourseMap | None:
        """Find a course map by ID and owner.

        Args:
            course_map_id: Course map UUID.
            user_id: Owner user UUID.

        Returns:
            CourseMap instance or None if not found or not owned by user.
        """
        stmt = select(CourseMap).where(
            CourseMap.id == course_map_id,
            CourseMap.user_id == user_id,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def find_by_user(self, user_id: UUID) -> list[CourseMap]:
        """Find all course maps for a user, ordered by creation date desc.

        Args:
            user_id: Owner user UUID.

        Returns:
            List of CourseMap instances.
        """
        stmt = (
            select(CourseMap)
            .where(CourseMap.user_id == user_id)
            .order_by(CourseMap.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def count_completed_nodes(
        self, user_id: UUID, course_map_id: UUID
    ) -> int:
        """Count completed nodes for a user's course map.

        Args:
            user_id: Owner user UUID.
            course_map_id: Course map UUID.

        Returns:
            Number of completed nodes.
        """
        stmt = select(func.count(NodeProgress.id)).where(
            NodeProgress.user_id == user_id,
            NodeProgress.course_map_id == course_map_id,
            NodeProgress.status == "completed",
        )
        result = await self.db.execute(stmt)
        return result.scalar() or 0

    async def save(self, course_map: CourseMap) -> CourseMap:
        """Persist a course map.

        Args:
            course_map: CourseMap entity to save.

        Returns:
            The saved course map.
        """
        self.db.add(course_map)
        return course_map
