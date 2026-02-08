"""Background content generation service.

This service handles background generation of all learn node contents
after a course map is created, using BackgroundTasks instead of Celery.
"""

import asyncio
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from app.core.logging import get_logger
from app.domain.repositories.node_content_repository import NodeContentRepository
from app.domain.services.node_content_service import NodeContentService
from app.llm.client import LLMClient

logger = get_logger(__name__)


class ContentGenerationService:
    """Service for background generation of node contents."""

    def __init__(
        self,
        llm_client: LLMClient,
        node_content_repo: NodeContentRepository,
    ) -> None:
        """Initialize content generation service.

        Args:
            llm_client: LLM client for generating content.
            node_content_repo: Repository for node content persistence.
        """
        self.llm = llm_client
        self.node_content_repo = node_content_repo
        self.node_content_service = NodeContentService(
            llm_client=llm_client,
            node_content_repo=node_content_repo,
        )

    async def generate_all_learn_nodes(
        self,
        course_map_id: UUID,
        nodes: list[dict[str, Any]],
        course_context: dict[str, Any],
    ) -> None:
        """Generate all learn node contents in background.

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
            learn_nodes = [n for n in nodes if n.get("type") == "learn"]
            logger.info(
                "Filtered learn nodes for generation",
                course_map_id=str(course_map_id),
                learn_nodes_count=len(learn_nodes),
            )

            nodes_by_layer = self._group_by_layer(learn_nodes)
            sorted_layers = sorted(nodes_by_layer.keys())

            logger.info(
                "Grouped nodes by layer",
                course_map_id=str(course_map_id),
                layers=sorted_layers,
                layer_sizes={layer: len(nodes_by_layer[layer]) for layer in sorted_layers},
            )

            for layer in sorted_layers:
                layer_nodes = nodes_by_layer[layer]
                logger.info(
                    "Generating nodes for layer",
                    course_map_id=str(course_map_id),
                    layer=layer,
                    node_count=len(layer_nodes),
                )

                semaphore = asyncio.Semaphore(3)

                async def generate_node_with_own_session(node: dict[str, Any]) -> None:
                    """Wrapper to create independent DB session for each node generation."""
                    from app.infrastructure.database import get_async_session_maker

                    session_maker = get_async_session_maker()
                    async with session_maker() as node_db:
                        temp_repo = NodeContentRepository(node_db)
                        temp_service = ContentGenerationService(
                            llm_client=self.llm,
                            node_content_repo=temp_repo,
                        )

                        await temp_service._generate_single_node(
                            course_map_id=course_map_id,
                            node=node,
                            course_context=course_context,
                            semaphore=semaphore,
                        )

                tasks = [generate_node_with_own_session(node) for node in layer_nodes]
                results = await asyncio.gather(*tasks, return_exceptions=True)

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
            existing = await self.node_content_repo.find_existing_knowledge_card(
                course_map_id=course_map_id,
                node_id=node_id,
            )

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
            await self.node_content_repo.update_generation_status(
                course_map_id=course_map_id,
                node_id=node_id,
                status="generating",
                started_at=datetime.now(timezone.utc),
            )
            await self.node_content_repo.commit()

            try:
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

                await self.node_content_repo.update_generation_status(
                    course_map_id=course_map_id,
                    node_id=node_id,
                    status="completed",
                    completed_at=datetime.now(timezone.utc),
                )
                await self.node_content_repo.commit()

                logger.info(
                    "Node content generated successfully",
                    course_map_id=str(course_map_id),
                    node_id=node_id,
                    total_pages=result.get("totalPagesInCard"),
                )

            except Exception as e:
                await self.node_content_repo.update_generation_status(
                    course_map_id=course_map_id,
                    node_id=node_id,
                    status="failed",
                    error=str(e),
                    completed_at=datetime.now(timezone.utc),
                )
                try:
                    await self.node_content_repo.commit()
                except Exception:
                    await self.node_content_repo.rollback()

                logger.error(
                    "Node content generation failed",
                    course_map_id=str(course_map_id),
                    node_id=node_id,
                    error=str(e),
                    exc_info=True,
                )
                raise


async def initialize_node_contents(
    course_map_id: UUID,
    nodes: list[dict[str, Any]],
    node_content_repo: NodeContentRepository,
) -> None:
    """Initialize node_contents records for all nodes in a course map.

    Args:
        course_map_id: Course map UUID.
        nodes: List of all nodes from the DAG.
        node_content_repo: Repository for node content data access.
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

            if node_type == "quiz":
                initial_status = "quiz_pending"
            else:
                initial_status = "pending"

            await node_content_repo.initialize_node(
                course_map_id=course_map_id,
                node_id=node_id,
                content_type="knowledge_card",
                node_type=node_type,
                initial_status=initial_status,
            )

        await node_content_repo.commit()

        logger.info(
            "Initialized node_contents records",
            course_map_id=str(course_map_id),
            total_nodes=len(nodes),
        )

    except Exception as e:
        await node_content_repo.rollback()
        logger.error(
            "Failed to initialize node_contents",
            course_map_id=str(course_map_id),
            error=str(e),
            exc_info=True,
        )
        raise
