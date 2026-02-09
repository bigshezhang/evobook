"""Node progress service for tracking user learning status.

This module provides business logic for reading and upserting
node progress records within a course map.
"""

from datetime import datetime, timezone
from uuid import UUID

from app.core.logging import get_logger
from app.domain.constants import VALID_NODE_STATUSES
from app.domain.repositories.node_progress_repository import NodeProgressRepository

logger = get_logger(__name__)

# Valid status values for node progress (imported from constants)
VALID_STATUSES = VALID_NODE_STATUSES


class NodeProgressService:
    """Service for managing per-node learning progress."""

    def __init__(self, node_progress_repo: NodeProgressRepository) -> None:
        """Initialize node progress service.

        Args:
            node_progress_repo: Repository for node progress data access.
        """
        self.node_progress_repo = node_progress_repo

    async def get_progress(
        self,
        user_id: UUID,
        course_map_id: UUID,
    ) -> list[dict]:
        """Get all node progress for a user's course map.

        Args:
            user_id: The authenticated user's ID.
            course_map_id: The course map to query progress for.

        Returns:
            List of dicts with node_id, status, and updated_at.
        """
        rows = await self.node_progress_repo.find_by_user_and_course(
            user_id=user_id,
            course_map_id=course_map_id,
        )

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

    async def update_progress(
        self,
        user_id: UUID,
        course_map_id: UUID,
        node_id: int,
        status: str,
    ) -> dict:
        """Update or create progress for a specific node.

        Uses PostgreSQL ON CONFLICT (upsert) on the unique constraint
        (user_id, course_map_id, node_id).

        Args:
            user_id: The authenticated user's ID.
            course_map_id: The course map the node belongs to.
            node_id: The DAG node ID.
            status: New status value (locked|unlocked|in_progress|completed).

        Returns:
            Dict with node_id, status, and updated_at.
        """
        now = datetime.now(tz=timezone.utc)

        await self.node_progress_repo.upsert_progress(
            user_id=user_id,
            course_map_id=course_map_id,
            node_id=node_id,
            status=status,
            now=now,
        )
        await self.node_progress_repo.commit()

        # Re-fetch to get the final row (including server-generated fields)
        row = await self.node_progress_repo.find_one(
            user_id=user_id,
            course_map_id=course_map_id,
            node_id=node_id,
        )

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

    async def batch_update(
        self,
        user_id: UUID,
        course_map_id: UUID,
        updates: list[dict],
    ) -> list[dict]:
        """Batch update multiple node progresses at once.

        Args:
            user_id: The authenticated user's ID.
            course_map_id: The course map the nodes belong to.
            updates: List of dicts each with node_id and status.

        Returns:
            List of dicts with node_id, status, and updated_at for all updated nodes.
        """
        now = datetime.now(tz=timezone.utc)

        for item in updates:
            await self.node_progress_repo.upsert_progress(
                user_id=user_id,
                course_map_id=course_map_id,
                node_id=item["node_id"],
                status=item["status"],
                now=now,
            )

        await self.node_progress_repo.commit()

        # Fetch all updated rows
        node_ids = [item["node_id"] for item in updates]
        rows = await self.node_progress_repo.find_by_node_ids(
            user_id=user_id,
            course_map_id=course_map_id,
            node_ids=node_ids,
        )

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
