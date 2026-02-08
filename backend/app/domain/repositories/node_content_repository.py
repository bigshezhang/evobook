"""Node content repository for generated learning materials data access."""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.node_content import NodeContent
from app.domain.repositories.base import BaseRepository


class NodeContentRepository(BaseRepository[NodeContent]):
    """Repository for NodeContent entity data access."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize node content repository.

        Args:
            db: Async database session.
        """
        super().__init__(db, NodeContent)

    async def find_cached_content(
        self,
        course_map_id: UUID,
        node_id: int,
        content_type: str,
        question_key: str | None = None,
    ) -> NodeContent | None:
        """Find cached content by composite key.

        Returns the most recently completed content record for the given key.

        Args:
            course_map_id: Course map UUID.
            node_id: Node ID within the course map.
            content_type: Content type discriminator.
            question_key: Optional hash key for question-specific content.

        Returns:
            NodeContent instance or None on cache miss.
        """
        stmt = select(NodeContent).where(
            NodeContent.course_map_id == course_map_id,
            NodeContent.node_id == node_id,
            NodeContent.content_type == content_type,
            NodeContent.question_key == question_key
            if question_key is not None
            else NodeContent.question_key.is_(None),
        ).order_by(
            NodeContent.generation_completed_at.desc().nulls_last()
        ).limit(1)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def upsert_content(
        self,
        course_map_id: UUID,
        node_id: int,
        content_type: str,
        content_json: dict[str, Any],
        question_key: str | None = None,
        generation_status: str = "completed",
        completed_at: datetime | None = None,
    ) -> None:
        """Upsert content using ON CONFLICT DO UPDATE.

        Args:
            course_map_id: Course map UUID.
            node_id: Node ID.
            content_type: Content type.
            content_json: Content data to store.
            question_key: Optional question hash key.
            generation_status: Generation status value.
            completed_at: Optional completion timestamp.
        """
        stmt = (
            pg_insert(NodeContent)
            .values(
                course_map_id=course_map_id,
                node_id=node_id,
                content_type=content_type,
                question_key=question_key,
                content_json=content_json,
                generation_status=generation_status,
                generation_completed_at=completed_at,
            )
            .on_conflict_do_update(
                index_elements=[
                    NodeContent.course_map_id,
                    NodeContent.node_id,
                    NodeContent.content_type,
                ],
                index_where=(NodeContent.question_key == question_key)
                if question_key is not None
                else (NodeContent.question_key.is_(None)),
                set_={
                    "content_json": content_json,
                    "generation_status": generation_status,
                    "generation_completed_at": completed_at,
                },
            )
        )
        await self.db.execute(stmt)

    async def initialize_node(
        self,
        course_map_id: UUID,
        node_id: int,
        content_type: str,
        node_type: str | None,
        initial_status: str,
    ) -> None:
        """Initialize a node_contents record (ON CONFLICT DO NOTHING).

        Args:
            course_map_id: Course map UUID.
            node_id: Node ID.
            content_type: Content type.
            node_type: Node type (learn | quiz).
            initial_status: Initial generation status.
        """
        stmt = (
            pg_insert(NodeContent)
            .values(
                course_map_id=course_map_id,
                node_id=node_id,
                content_type=content_type,
                question_key=None,
                content_json={},
                generation_status=initial_status,
                node_type=node_type,
            )
            .on_conflict_do_nothing(
                index_elements=[
                    NodeContent.course_map_id,
                    NodeContent.node_id,
                    NodeContent.content_type,
                ],
                index_where=NodeContent.question_key.is_(None),
            )
        )
        await self.db.execute(stmt)

    async def find_by_course_map(self, course_map_id: UUID) -> list[NodeContent]:
        """Find all node contents for a course map.

        Args:
            course_map_id: Course map UUID.

        Returns:
            List of NodeContent instances.
        """
        stmt = select(NodeContent).where(
            NodeContent.course_map_id == course_map_id
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def find_existing_knowledge_card(
        self, course_map_id: UUID, node_id: int
    ) -> NodeContent | None:
        """Find an existing knowledge card for idempotency checks.

        Args:
            course_map_id: Course map UUID.
            node_id: Node ID.

        Returns:
            NodeContent instance or None.
        """
        stmt = select(NodeContent).where(
            NodeContent.course_map_id == course_map_id,
            NodeContent.node_id == node_id,
            NodeContent.content_type == "knowledge_card",
        ).limit(1)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def update_generation_status(
        self,
        course_map_id: UUID,
        node_id: int,
        status: str,
        started_at: datetime | None = None,
        completed_at: datetime | None = None,
        error: str | None = None,
    ) -> None:
        """Update generation status for a node content record.

        Args:
            course_map_id: Course map UUID.
            node_id: Node ID.
            status: New generation status.
            started_at: Optional start timestamp.
            completed_at: Optional completion timestamp.
            error: Optional error message.
        """
        values: dict[str, Any] = {"generation_status": status}
        if started_at is not None:
            values["generation_started_at"] = started_at
        if completed_at is not None:
            values["generation_completed_at"] = completed_at
        if error is not None:
            values["generation_error"] = error

        stmt = (
            update(NodeContent)
            .where(
                NodeContent.course_map_id == course_map_id,
                NodeContent.node_id == node_id,
                NodeContent.content_type == "knowledge_card",
            )
            .values(**values)
        )
        await self.db.execute(stmt)

    async def find_incomplete_course_map_ids(self) -> list[UUID]:
        """Find course map IDs with incomplete generation tasks.

        Returns:
            List of course map UUIDs with pending or generating nodes.
        """
        stmt = (
            select(NodeContent.course_map_id)
            .distinct()
            .where(NodeContent.generation_status.in_(["generating", "pending"]))
        )
        result = await self.db.execute(stmt)
        return [row[0] for row in result.fetchall()]

    async def reset_generating_to_pending(self) -> int:
        """Reset all 'generating' nodes back to 'pending'.

        Returns:
            Number of rows updated.
        """
        stmt = (
            update(NodeContent)
            .where(NodeContent.generation_status == "generating")
            .values(
                generation_status="pending",
                generation_started_at=None,
            )
        )
        result = await self.db.execute(stmt)
        return result.rowcount
