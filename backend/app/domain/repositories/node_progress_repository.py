"""Node progress repository for tracking learning status data access."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.node_progress import NodeProgress
from app.domain.repositories.base import BaseRepository


class NodeProgressRepository(BaseRepository[NodeProgress]):
    """Repository for NodeProgress entity data access."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize node progress repository.

        Args:
            db: Async database session.
        """
        super().__init__(db, NodeProgress)

    async def find_by_user_and_course(
        self, user_id: UUID, course_map_id: UUID
    ) -> list[NodeProgress]:
        """Find all node progress records for a user's course map.

        Args:
            user_id: User UUID.
            course_map_id: Course map UUID.

        Returns:
            List of NodeProgress instances ordered by node_id.
        """
        stmt = (
            select(NodeProgress)
            .where(
                NodeProgress.user_id == user_id,
                NodeProgress.course_map_id == course_map_id,
            )
            .order_by(NodeProgress.node_id)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def upsert_progress(
        self,
        user_id: UUID,
        course_map_id: UUID,
        node_id: int,
        status: str,
        now: datetime,
    ) -> None:
        """Upsert a node progress record using ON CONFLICT.

        Args:
            user_id: User UUID.
            course_map_id: Course map UUID.
            node_id: DAG node ID.
            status: New status value.
            now: Current timestamp.
        """
        stmt = pg_insert(NodeProgress).values(
            user_id=user_id,
            course_map_id=course_map_id,
            node_id=node_id,
            status=status,
            updated_at=now,
        )
        stmt = stmt.on_conflict_do_update(
            constraint="uq_user_course_node",
            set_={
                "status": stmt.excluded.status,
                "updated_at": now,
            },
        )
        await self.db.execute(stmt)

    async def find_one(
        self, user_id: UUID, course_map_id: UUID, node_id: int
    ) -> NodeProgress:
        """Find a single node progress record.

        Args:
            user_id: User UUID.
            course_map_id: Course map UUID.
            node_id: DAG node ID.

        Returns:
            NodeProgress instance.

        Raises:
            NoResultFound: If no matching record exists.
        """
        stmt = select(NodeProgress).where(
            NodeProgress.user_id == user_id,
            NodeProgress.course_map_id == course_map_id,
            NodeProgress.node_id == node_id,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one()

    async def find_by_node_ids(
        self,
        user_id: UUID,
        course_map_id: UUID,
        node_ids: list[int],
    ) -> list[NodeProgress]:
        """Find progress records for specific node IDs.

        Args:
            user_id: User UUID.
            course_map_id: Course map UUID.
            node_ids: List of node IDs to fetch.

        Returns:
            List of NodeProgress instances ordered by node_id.
        """
        stmt = (
            select(NodeProgress)
            .where(
                NodeProgress.user_id == user_id,
                NodeProgress.course_map_id == course_map_id,
                NodeProgress.node_id.in_(node_ids),
            )
            .order_by(NodeProgress.node_id)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
