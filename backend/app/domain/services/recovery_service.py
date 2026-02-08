"""Service for recovering incomplete content generation tasks on startup.

This service handles automatic recovery of background content generation
tasks that were interrupted due to server restart or crash.
"""

import asyncio
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.domain.models.course_map import CourseMap
from app.domain.models.node_content import NodeContent
from app.infrastructure.database import get_async_session_maker

logger = get_logger(__name__)


class RecoveryService:
    """Service to recover incomplete generation tasks after server restart."""

    async def recover_incomplete_tasks(
        self,
        db: AsyncSession,
        content_generation_service,
    ) -> dict[str, int]:
        """Recover all incomplete content generation tasks.

        This method:
        1. Finds all courses with nodes in 'generating' or 'pending' status
        2. Resets 'generating' status to 'pending' (since process was interrupted)
        3. Restarts background generation tasks for each affected course

        Args:
            db: Database session
            content_generation_service: Service to generate content

        Returns:
            Dict with recovery statistics:
            - courses_found: Number of courses with incomplete tasks
            - nodes_reset: Number of nodes reset from 'generating' to 'pending'
            - tasks_restarted: Number of background tasks successfully restarted
        """
        stats = {
            "courses_found": 0,
            "nodes_reset": 0,
            "tasks_restarted": 0,
        }

        try:
            # 1. Find all courses with incomplete generation tasks
            stmt = (
                select(NodeContent.course_map_id)
                .distinct()
                .where(NodeContent.generation_status.in_(["generating", "pending"]))
            )
            result = await db.execute(stmt)
            course_map_ids = [row[0] for row in result.fetchall()]

            stats["courses_found"] = len(course_map_ids)

            if not course_map_ids:
                logger.info("No incomplete tasks found, recovery not needed")
                return stats

            logger.info(
                "Found incomplete tasks",
                course_count=len(course_map_ids),
                course_map_ids=[str(cid) for cid in course_map_ids],
            )

            # 2. Reset all 'generating' status to 'pending'
            # (because the process was interrupted, they cannot still be generating)
            reset_stmt = (
                update(NodeContent)
                .where(NodeContent.generation_status == "generating")
                .values(
                    generation_status="pending",
                    generation_started_at=None,
                )
            )
            result = await db.execute(reset_stmt)
            stats["nodes_reset"] = result.rowcount
            await db.commit()

            logger.info(
                "Reset generating nodes to pending",
                count=stats["nodes_reset"],
            )

            # 3. Restart background generation task for each course
            for course_map_id in course_map_ids:
                try:
                    await self._restart_course_generation(
                        course_map_id,
                        db,
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
                    # Continue with other courses

            logger.info(
                "Recovery completed",
                stats=stats,
            )

            return stats

        except Exception as e:
            logger.error(
                "Recovery failed",
                error=str(e),
                exc_info=True,
            )
            raise

    async def _restart_course_generation(
        self,
        course_map_id: UUID,
        db: AsyncSession,
        content_generation_service,
    ) -> None:
        """Restart generation for a specific course.

        Args:
            course_map_id: Course map UUID
            db: Database session
            content_generation_service: Service to generate content
        """
        # 1. Get course map information
        stmt = select(CourseMap).where(CourseMap.id == course_map_id)
        result = await db.execute(stmt)
        course_map = result.scalar_one_or_none()

        if not course_map:
            logger.warning(
                "Course map not found, cannot restart generation",
                course_map_id=str(course_map_id),
            )
            return

        # 2. Prepare course context (read language from persisted course map)
        course_context = {
            "course_name": course_map.map_meta.get("course_name", ""),
            "strategy_rationale": course_map.map_meta.get("strategy_rationale", ""),
            "topic": course_map.topic or "",
            "level": course_map.level or "Beginner",
            "mode": course_map.map_meta.get("mode", "Fast"),
            "language": getattr(course_map, "language", "en") or "en",
        }

        # 3. Start background generation task with its own database session
        # Note: Cannot use BackgroundTasks here (no request context during startup)
        # Use asyncio.create_task instead
        # CRITICAL: Create a new database session for each task to avoid conflicts
        import asyncio
        from app.infrastructure.database import get_async_session_maker
        from app.domain.services.node_content_service import NodeContentService

        async def run_generation_with_own_session():
            """Wrapper to create an independent DB session for this generation task."""
            # Import here to avoid circular dependency
            from app.domain.services.content_generation_service import ContentGenerationService
            from app.domain.services.node_content_service import NodeContentService

            session_maker = get_async_session_maker()
            async with session_maker() as task_db:
                # Create a new service instance with its own DB session
                node_content_service = NodeContentService(
                    llm_client=content_generation_service.llm,
                    db_session=task_db,
                )
                task_generation_service = ContentGenerationService(
                    llm_client=content_generation_service.llm,
                    db_session=task_db,
                )
                task_generation_service.node_content_service = node_content_service

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
