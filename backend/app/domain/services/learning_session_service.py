"""Learning session service for tracking study time via heartbeats.

This module provides business logic for processing learning heartbeats
and managing accumulated study time per node.
"""

from datetime import datetime, timezone
from uuid import UUID

from app.core.logging import get_logger
from app.domain.models.learning_activity import LearningActivity
from app.domain.repositories.course_map_repository import CourseMapRepository
from app.domain.repositories.learning_activity_repository import LearningActivityRepository
from app.domain.repositories.user_stats_repository import UserStatsRepository

logger = get_logger(__name__)

# Heartbeat interval (seconds)
HEARTBEAT_INTERVAL_SECONDS = 30


class LearningSessionService:
    """Learning session service, handles heartbeats and study time tracking."""

    def __init__(
        self,
        course_map_repo: CourseMapRepository,
        learning_activity_repo: LearningActivityRepository,
        user_stats_repo: UserStatsRepository,
    ) -> None:
        """Initialize learning session service.

        Args:
            course_map_repo: Repository for course map data access.
            learning_activity_repo: Repository for learning activity data access.
            user_stats_repo: Repository for user stats data access.
        """
        self.course_map_repo = course_map_repo
        self.learning_activity_repo = learning_activity_repo
        self.user_stats_repo = user_stats_repo

    async def process_heartbeat(
        self,
        user_id: UUID,
        course_map_id: UUID,
        node_id: int,
    ) -> dict:
        """Process a learning heartbeat.

        Business logic:
        1. Verify course_map exists and belongs to this user
        2. Verify node exists in the course_map DAG
        3. Check if node accumulated time exceeds limit (estimated_minutes * 2)
        4. Atomically update user_stats.total_study_seconds += 30
        5. Update node accumulated time in learning_activities
        6. Return acknowledged + total_study_seconds

        Args:
            user_id: User UUID.
            course_map_id: Course map UUID.
            node_id: Node ID.

        Returns:
            Dict with acknowledged, total_study_seconds, reason.
        """
        # 1. Verify course map exists and belongs to user
        course_map = await self.course_map_repo.find_by_id_and_user(
            course_map_id=course_map_id,
            user_id=user_id,
        )

        if not course_map:
            logger.warning(
                "Heartbeat rejected: course map not found or not owned by user",
                user_id=str(user_id),
                course_map_id=str(course_map_id),
            )
            return {
                "acknowledged": False,
                "total_study_seconds": 0,
                "reason": "COURSE_NOT_FOUND",
            }

        # 2. Verify node exists in DAG
        nodes = course_map.nodes or []
        target_node = next((n for n in nodes if n.get("id") == node_id), None)

        if not target_node:
            logger.warning(
                "Heartbeat rejected: node not found in course DAG",
                user_id=str(user_id),
                course_map_id=str(course_map_id),
                node_id=node_id,
            )
            return {
                "acknowledged": False,
                "total_study_seconds": 0,
                "reason": "NODE_NOT_FOUND",
            }

        # 3. Check time limit for this node
        estimated_minutes = target_node.get("estimated_minutes", 0)
        time_limit_seconds = estimated_minutes * 2 * 60

        accumulated_seconds = await self._get_node_accumulated_seconds(
            user_id=user_id,
            course_map_id=course_map_id,
            node_id=node_id,
        )

        if accumulated_seconds >= time_limit_seconds > 0:
            logger.info(
                "Heartbeat acknowledged but not counted: time limit reached",
                user_id=str(user_id),
                course_map_id=str(course_map_id),
                node_id=node_id,
                accumulated_seconds=accumulated_seconds,
                time_limit_seconds=time_limit_seconds,
            )
            stats = await self.user_stats_repo.find_by_user_id(user_id)
            current_total = stats.total_study_seconds if stats else 0

            return {
                "acknowledged": False,
                "total_study_seconds": current_total,
                "reason": "TIME_LIMIT_REACHED",
            }

        # 4. Atomically update user_stats.total_study_seconds
        now = datetime.now(tz=timezone.utc)
        await self.user_stats_repo.upsert_add_study_seconds(
            user_id=user_id,
            seconds=HEARTBEAT_INTERVAL_SECONDS,
            now=now,
        )

        # 5. Update node accumulated time
        await self._update_node_accumulated_time(
            user_id=user_id,
            course_map_id=course_map_id,
            node_id=node_id,
            seconds_to_add=HEARTBEAT_INTERVAL_SECONDS,
        )

        await self.user_stats_repo.commit()

        # 6. Fetch updated total
        stats = await self.user_stats_repo.find_by_user_id(user_id)

        logger.info(
            "Heartbeat processed successfully",
            user_id=str(user_id),
            course_map_id=str(course_map_id),
            node_id=node_id,
            total_study_seconds=stats.total_study_seconds,
        )

        return {
            "acknowledged": True,
            "total_study_seconds": stats.total_study_seconds,
            "reason": None,
        }

    async def _get_node_accumulated_seconds(
        self,
        user_id: UUID,
        course_map_id: UUID,
        node_id: int,
    ) -> int:
        """Get accumulated study seconds for a node.

        Args:
            user_id: User UUID.
            course_map_id: Course map UUID.
            node_id: Node ID.

        Returns:
            Accumulated seconds (0 if no record).
        """
        activity = await self.learning_activity_repo.find_node_in_progress(
            user_id=user_id,
            course_map_id=course_map_id,
            node_id=node_id,
        )

        if not activity or not activity.extra_data:
            return 0

        return activity.extra_data.get("accumulated_seconds", 0)

    async def _update_node_accumulated_time(
        self,
        user_id: UUID,
        course_map_id: UUID,
        node_id: int,
        seconds_to_add: int,
    ) -> None:
        """Update accumulated study time for a node.

        Args:
            user_id: User UUID.
            course_map_id: Course map UUID.
            node_id: Node ID.
            seconds_to_add: Seconds to add.
        """
        now = datetime.now(tz=timezone.utc)

        activity = await self.learning_activity_repo.find_node_in_progress(
            user_id=user_id,
            course_map_id=course_map_id,
            node_id=node_id,
        )

        if activity:
            current_seconds = activity.extra_data.get("accumulated_seconds", 0) if activity.extra_data else 0
            new_seconds = current_seconds + seconds_to_add
            activity.extra_data = {"accumulated_seconds": new_seconds}
            activity.completed_at = now
        else:
            activity = LearningActivity(
                user_id=user_id,
                course_map_id=course_map_id,
                node_id=node_id,
                activity_type="node_in_progress",
                completed_at=now,
                extra_data={"accumulated_seconds": seconds_to_add},
            )
            await self.learning_activity_repo.create(activity)

        await self.learning_activity_repo.flush()
