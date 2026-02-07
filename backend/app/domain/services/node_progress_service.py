"""Node progress service for tracking user learning status.

This module provides business logic for reading and upserting
node progress records within a course map.
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.domain.models.node_progress import NodeProgress

logger = get_logger(__name__)

# Valid status values for node progress
VALID_STATUSES = {"locked", "unlocked", "in_progress", "completed"}


class NodeProgressService:
    """Service for managing per-node learning progress."""

    @staticmethod
    async def get_progress(
        user_id: UUID,
        course_map_id: UUID,
        db: AsyncSession,
    ) -> list[dict]:
        """Get all node progress for a user's course map.

        Args:
            user_id: The authenticated user's ID.
            course_map_id: The course map to query progress for.
            db: Async database session.

        Returns:
            List of dicts with node_id, status, and updated_at.
        """
        stmt = (
            select(NodeProgress)
            .where(
                NodeProgress.user_id == user_id,
                NodeProgress.course_map_id == course_map_id,
            )
            .order_by(NodeProgress.node_id)
        )
        result = await db.execute(stmt)
        rows = result.scalars().all()

        logger.info(
            "Fetched node progress",
            user_id=str(user_id),
            course_map_id=str(course_map_id),
            count=len(rows),
        )

        return [
            {
                "node_id": row.node_id,
                "status": row.status,
                "updated_at": row.updated_at.isoformat(),
            }
            for row in rows
        ]

    @staticmethod
    async def update_progress(
        user_id: UUID,
        course_map_id: UUID,
        node_id: int,
        status: str,
        db: AsyncSession,
    ) -> dict:
        """Update or create progress for a specific node.

        Uses PostgreSQL ON CONFLICT (upsert) on the unique constraint
        (user_id, course_map_id, node_id).

        Args:
            user_id: The authenticated user's ID.
            course_map_id: The course map the node belongs to.
            node_id: The DAG node ID.
            status: New status value (locked|unlocked|in_progress|completed).
            db: Async database session.

        Returns:
            Dict with node_id, status, and updated_at.
        """
        now = datetime.now(tz=timezone.utc)

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
        await db.execute(stmt)
        await db.commit()

        # Re-fetch to get the final row (including server-generated fields)
        fetch_stmt = select(NodeProgress).where(
            NodeProgress.user_id == user_id,
            NodeProgress.course_map_id == course_map_id,
            NodeProgress.node_id == node_id,
        )
        result = await db.execute(fetch_stmt)
        row = result.scalar_one()

        logger.info(
            "Updated node progress",
            user_id=str(user_id),
            course_map_id=str(course_map_id),
            node_id=node_id,
            status=status,
        )

        return {
            "node_id": row.node_id,
            "status": row.status,
            "updated_at": row.updated_at.isoformat(),
        }

    @staticmethod
    async def batch_update(
        user_id: UUID,
        course_map_id: UUID,
        updates: list[dict],
        db: AsyncSession,
    ) -> list[dict]:
        """Batch update multiple node progresses at once.

        Args:
            user_id: The authenticated user's ID.
            course_map_id: The course map the nodes belong to.
            updates: List of dicts each with node_id and status.
            db: Async database session.

        Returns:
            List of dicts with node_id, status, and updated_at for all updated nodes.
        """
        now = datetime.now(tz=timezone.utc)

        for item in updates:
            stmt = pg_insert(NodeProgress).values(
                user_id=user_id,
                course_map_id=course_map_id,
                node_id=item["node_id"],
                status=item["status"],
                updated_at=now,
            )
            stmt = stmt.on_conflict_do_update(
                constraint="uq_user_course_node",
                set_={
                    "status": stmt.excluded.status,
                    "updated_at": now,
                },
            )
            await db.execute(stmt)

        await db.commit()

        # Fetch all updated rows
        node_ids = [item["node_id"] for item in updates]
        fetch_stmt = (
            select(NodeProgress)
            .where(
                NodeProgress.user_id == user_id,
                NodeProgress.course_map_id == course_map_id,
                NodeProgress.node_id.in_(node_ids),
            )
            .order_by(NodeProgress.node_id)
        )
        result = await db.execute(fetch_stmt)
        rows = result.scalars().all()

        logger.info(
            "Batch updated node progress",
            user_id=str(user_id),
            course_map_id=str(course_map_id),
            count=len(rows),
        )

        return [
            {
                "node_id": row.node_id,
                "status": row.status,
                "updated_at": row.updated_at.isoformat(),
            }
            for row in rows
        ]
