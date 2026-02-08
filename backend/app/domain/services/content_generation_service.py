"""Background content generation service.

This service handles background generation of all learn node contents
after a course map is created, using BackgroundTasks instead of Celery.
"""

import asyncio
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.domain.models.node_content import NodeContent
from app.domain.services.node_content_service import NodeContentService
from app.infrastructure.database import get_async_session_maker
from app.llm.client import LLMClient

logger = get_logger(__name__)


class ContentGenerationService:
    """Service for background generation of node contents."""

    def __init__(self, llm_client: LLMClient, db_session: AsyncSession) -> None:
        """Initialize content generation service.

        Args:
            llm_client: LLM client for generating content.
            db_session: Database session for persistence.
        """
        self.llm = llm_client
        self.db = db_session
        self.node_content_service = NodeContentService(llm_client=llm_client, db_session=db_session)

    async def generate_all_learn_nodes(
        self,
        course_map_id: UUID,
        nodes: list[dict[str, Any]],
        course_context: dict[str, Any],
    ) -> None:
        """Generate all learn node contents in background.

        This method runs in background and generates content for all learn nodes.
        Quiz nodes are skipped (they remain in quiz_pending status).

        Args:
            course_map_id: Course map UUID.
            nodes: List of all nodes from the DAG.
            course_context: Course metadata (topic, level, mode, etc.).
        """
        logger.info(
            "Starting background generation for all learn nodes",
            course_map_id=str(course_map_id),
            total_nodes=len(nodes),
        )

        try:
            # Filter learn nodes only
            learn_nodes = [n for n in nodes if n.get("type") == "learn"]
            logger.info(
                "Filtered learn nodes for generation",
                course_map_id=str(course_map_id),
                learn_nodes_count=len(learn_nodes),
            )

            # Group by layer (generate lower layers first)
            nodes_by_layer = self._group_by_layer(learn_nodes)
            sorted_layers = sorted(nodes_by_layer.keys())

            logger.info(
                "Grouped nodes by layer",
                course_map_id=str(course_map_id),
                layers=sorted_layers,
                layer_sizes={layer: len(nodes_by_layer[layer]) for layer in sorted_layers},
            )

            # Generate layer by layer
            for layer in sorted_layers:
                layer_nodes = nodes_by_layer[layer]
                logger.info(
                    "Generating nodes for layer",
                    course_map_id=str(course_map_id),
                    layer=layer,
                    node_count=len(layer_nodes),
                )

                # Use semaphore to control concurrency (max 3 at a time)
                semaphore = asyncio.Semaphore(3)

                # Create wrapper function that uses independent DB session for each node
                async def generate_node_with_own_session(node: dict[str, Any]):
                    """Wrapper to create independent DB session for each node generation."""
                    from app.infrastructure.database import get_async_session_maker
                    
                    session_maker = get_async_session_maker()
                    async with session_maker() as node_db:
                        # Create a temporary service instance with its own DB session
                        temp_service = ContentGenerationService(
                            llm_client=self.llm,
                            db_session=node_db,
                        )
                        temp_service.node_content_service = NodeContentService(
                            llm_client=self.llm,
                            db_session=node_db,
                        )
                        
                        await temp_service._generate_single_node(
                            course_map_id=course_map_id,
                            node=node,
                            course_context=course_context,
                            semaphore=semaphore,
                        )

                tasks = [generate_node_with_own_session(node) for node in layer_nodes]

                # Gather with return_exceptions=True to continue on failures
                results = await asyncio.gather(*tasks, return_exceptions=True)

                # Log any exceptions
                for i, result in enumerate(results):
                    if isinstance(result, Exception):
                        node_id = layer_nodes[i].get("id")
                        logger.error(
                            "Node generation failed",
                            course_map_id=str(course_map_id),
                            node_id=node_id,
                            layer=layer,
                            error=str(result),
                        )

            logger.info(
                "Background generation completed",
                course_map_id=str(course_map_id),
                total_learn_nodes=len(learn_nodes),
            )

        except Exception as e:
            logger.error(
                "Background generation failed",
                course_map_id=str(course_map_id),
                error=str(e),
                exc_info=True,
            )

    def _group_by_layer(self, nodes: list[dict[str, Any]]) -> dict[int, list[dict[str, Any]]]:
        """Group nodes by layer number.

        Args:
            nodes: List of node dictionaries.

        Returns:
            Dictionary mapping layer number to list of nodes.
        """
        grouped: dict[int, list[dict[str, Any]]] = {}
        for node in nodes:
            layer = node.get("layer", 1)
            if layer not in grouped:
                grouped[layer] = []
            grouped[layer].append(node)
        return grouped

    async def _generate_single_node(
        self,
        course_map_id: UUID,
        node: dict[str, Any],
        course_context: dict[str, Any],
        semaphore: asyncio.Semaphore,
    ) -> None:
        """Generate content for a single node with retry logic.

        Args:
            course_map_id: Course map UUID.
            node: Node dictionary from DAG.
            course_context: Course metadata.
            semaphore: Asyncio semaphore for concurrency control.
        """
        async with semaphore:
            node_id = node.get("id")

            # 0. Check if already generated (idempotency)
            # Use first() instead of scalar_one_or_none() to handle potential duplicate records gracefully
            stmt = select(NodeContent).where(
                NodeContent.course_map_id == course_map_id,
                NodeContent.node_id == node_id,
                NodeContent.content_type == "knowledge_card",
            ).limit(1)
            result = await self.db.execute(stmt)
            existing = result.scalars().first()

            if (
                existing
                and existing.generation_status == "completed"
                and existing.content_json
                and len(existing.content_json) > 0
            ):
                logger.info(
                    "Node already generated, skipping",
                    course_map_id=str(course_map_id),
                    node_id=node_id,
                )
                return

            logger.info(
                "Starting node content generation",
                course_map_id=str(course_map_id),
                node_id=node_id,
                node_title=node.get("title"),
            )

            # Update status to generating
            await self._update_generation_status(
                course_map_id=course_map_id,
                node_id=node_id,
                status="generating",
                started_at=datetime.now(timezone.utc),
            )

            try:
                # Build request parameters from course_context and node
                result = await self.node_content_service.generate_knowledge_card(
                    language=course_context.get("language", "en"),
                    course_name=course_context.get("course_name", ""),
                    course_context=course_context.get("strategy_rationale", ""),
                    topic=course_context.get("topic", ""),
                    level=course_context.get("level", "Beginner"),
                    mode=course_context.get("mode", "Deep"),
                    node_id=node_id,
                    node_title=node.get("title", ""),
                    node_description=node.get("description", ""),
                    node_type="learn",
                    estimated_minutes=node.get("estimated_minutes", 10),
                    course_map_id=course_map_id,
                    user_id=None,
                )

                # Update status to completed
                await self._update_generation_status(
                    course_map_id=course_map_id,
                    node_id=node_id,
                    status="completed",
                    completed_at=datetime.now(timezone.utc),
                )

                logger.info(
                    "Node content generated successfully",
                    course_map_id=str(course_map_id),
                    node_id=node_id,
                    total_pages=result.get("totalPagesInCard"),
                )

            except Exception as e:
                # Update status to failed with error message
                await self._update_generation_status(
                    course_map_id=course_map_id,
                    node_id=node_id,
                    status="failed",
                    error=str(e),
                    completed_at=datetime.now(timezone.utc),
                )

                logger.error(
                    "Node content generation failed",
                    course_map_id=str(course_map_id),
                    node_id=node_id,
                    error=str(e),
                    exc_info=True,
                )
                raise

    async def _update_generation_status(
        self,
        course_map_id: UUID,
        node_id: int,
        status: str,
        started_at: datetime | None = None,
        completed_at: datetime | None = None,
        error: str | None = None,
    ) -> None:
        """Update generation status for a node content.

        Args:
            course_map_id: Course map UUID.
            node_id: Node ID.
            status: New generation status.
            started_at: Optional start timestamp.
            completed_at: Optional completion timestamp.
            error: Optional error message.
        """
        try:
            # Build update values
            values: dict[str, Any] = {"generation_status": status}
            if started_at is not None:
                values["generation_started_at"] = started_at
            if completed_at is not None:
                values["generation_completed_at"] = completed_at
            if error is not None:
                values["generation_error"] = error

            # Update the record
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
            await self.db.commit()

            logger.info(
                "Updated generation status",
                course_map_id=str(course_map_id),
                node_id=node_id,
                status=status,
            )

        except Exception as e:
            # Rollback on error
            await self.db.rollback()
            logger.error(
                "Failed to update generation status",
                course_map_id=str(course_map_id),
                node_id=node_id,
                status=status,
                error=str(e),
                exc_info=True,
            )


async def initialize_node_contents(
    course_map_id: UUID,
    nodes: list[dict[str, Any]],
    db: AsyncSession,
) -> None:
    """Initialize node_contents records for all nodes in a course map.

    This creates initial records with status='pending' for learn nodes
    and status='quiz_pending' for quiz nodes.

    Args:
        course_map_id: Course map UUID.
        nodes: List of all nodes from the DAG.
        db: Database session.
    """
    logger.info(
        "Initializing node_contents records",
        course_map_id=str(course_map_id),
        total_nodes=len(nodes),
    )

    try:
        for node in nodes:
            node_id = node.get("id")
            node_type = node.get("type")

            # Determine initial status based on node type
            if node_type == "quiz":
                initial_status = "quiz_pending"
            else:
                initial_status = "pending"

            # Use INSERT ... ON CONFLICT DO NOTHING to avoid duplicates
            # if this function is called more than once for the same course_map
            stmt = (
                pg_insert(NodeContent)
                .values(
                    course_map_id=course_map_id,
                    node_id=node_id,
                    content_type="knowledge_card",
                    question_key=None,
                    content_json={},  # Empty content initially
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
            await db.execute(stmt)

        await db.commit()

        logger.info(
            "Initialized node_contents records",
            course_map_id=str(course_map_id),
            total_nodes=len(nodes),
        )

    except Exception as e:
        await db.rollback()
        logger.error(
            "Failed to initialize node_contents",
            course_map_id=str(course_map_id),
            error=str(e),
            exc_info=True,
        )
        raise
