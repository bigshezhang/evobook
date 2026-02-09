"""Service for recovering incomplete content generation tasks on startup.

This service handles automatic recovery of background content generation
tasks that were interrupted due to server restart or crash.
"""

import asyncio
from uuid import UUID

from app.core.logging import get_logger
from app.domain.repositories.course_map_repository import CourseMapRepository
from app.domain.repositories.node_content_repository import NodeContentRepository

logger = get_logger(__name__)


class RecoveryService:
    """Service to recover incomplete generation tasks after server restart."""

    def __init__(
        self,
        node_content_repo: NodeContentRepository,
        course_map_repo: CourseMapRepository,
    ) -> None:
        """Initialize recovery service.

        Args:
            node_content_repo: Repository for node content data access.
            course_map_repo: Repository for course map data access.
        """
        self.node_content_repo = node_content_repo
        self.course_map_repo = course_map_repo

    async def recover_incomplete_tasks(
        self,
        content_generation_service: object,
    ) -> dict[str, int]:
        """Recover all incomplete content generation tasks.

        Args:
            content_generation_service: Service to generate content.

        Returns:
            Dict with recovery statistics.
        """
        stats = {
            "courses_found": 0,
            "nodes_reset": 0,
            "tasks_restarted": 0,
        }

        try:
            # 1. Find courses with incomplete tasks
            course_map_ids = await self.node_content_repo.find_incomplete_course_map_ids()
            stats["courses_found"] = len(course_map_ids)

            if not course_map_ids:
                logger.info("No incomplete tasks found, recovery not needed")
                return stats

            logger.info(
                "Found incomplete tasks",
                course_count=len(course_map_ids),
                course_map_ids=[str(cid) for cid in course_map_ids],
            )

            # 2. Reset 'generating' status to 'pending'
            nodes_reset = await self.node_content_repo.reset_generating_to_pending()
            stats["nodes_reset"] = nodes_reset
            await self.node_content_repo.commit()

            logger.info("Reset generating nodes to pending", count=stats["nodes_reset"])

            # 3. Restart generation tasks
            for course_map_id in course_map_ids:
                try:
                    await self._restart_course_generation(
                        course_map_id,
                        content_generation_service,
                    )
                    stats["tasks_restarted"] += 1
                except Exception as e:
                    logger.error(
                        "Failed to restart generation for course",
                        course_map_id=str(course_map_id),
                        error=str(e),
                        exc_info=True,
                    )

            logger.info("Recovery completed", stats=stats)
            return stats

        except Exception as e:
            logger.error("Recovery failed", error=str(e), exc_info=True)
            raise

    async def _restart_course_generation(
        self,
        course_map_id: UUID,
        content_generation_service: object,
    ) -> None:
        """Restart generation for a specific course.

        Args:
            course_map_id: Course map UUID.
            content_generation_service: Service to generate content.
        """
        course_map = await self.course_map_repo.find_by_id(course_map_id)

        if not course_map:
            logger.warning(
                "Course map not found, cannot restart generation",
                course_map_id=str(course_map_id),
            )
            return

        course_context = {
            "course_name": course_map.map_meta.get("course_name", ""),
            "strategy_rationale": course_map.map_meta.get("strategy_rationale", ""),
            "topic": course_map.topic or "",
            "level": course_map.level or "Beginner",
            "mode": course_map.map_meta.get("mode", "Fast"),
            "language": getattr(course_map, "language", "en") or "en",
        }

        from app.infrastructure.database import get_async_session_maker
        from app.domain.services.content_generation_service import ContentGenerationService
        from app.domain.repositories.node_content_repository import NodeContentRepository

        async def run_generation_with_own_session() -> None:
            """Wrapper to create an independent DB session for this generation task."""
            session_maker = get_async_session_maker()
            async with session_maker() as task_db:
                task_repo = NodeContentRepository(task_db)
                task_generation_service = ContentGenerationService(
                    llm_client=content_generation_service.llm,  # type: ignore[attr-defined]
                    node_content_repo=task_repo,
                )

                await task_generation_service.generate_all_learn_nodes(
                    course_map_id=course_map_id,
                    nodes=course_map.nodes,
                    course_context=course_context,
                )

        task = asyncio.create_task(run_generation_with_own_session())

        logger.info(
            "Restarted generation task for course",
            course_map_id=str(course_map_id),
            task_name=task.get_name(),
        )
