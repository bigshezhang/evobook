"""Activity service for tracking user learning history.

This module provides business logic for recording and retrieving
learning activities for the activity heatmap feature.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.core.logging import get_logger
from app.domain.models.learning_activity import LearningActivity
from app.domain.repositories.course_map_repository import CourseMapRepository
from app.domain.repositories.learning_activity_repository import LearningActivityRepository
from app.domain.repositories.user_stats_repository import UserStatsRepository

logger = get_logger(__name__)

# Valid activity types
VALID_ACTIVITY_TYPES = {"node_completed", "quiz_passed", "knowledge_card_finished", "course_completed", "node_in_progress"}


class ActivityService:
    """Service for managing learning activity history."""

    def __init__(
        self,
        learning_activity_repo: LearningActivityRepository,
        course_map_repo: CourseMapRepository,
        user_stats_repo: UserStatsRepository,
    ) -> None:
        """Initialize activity service.

        Args:
            learning_activity_repo: Repository for learning activity data access.
            course_map_repo: Repository for course map data access.
            user_stats_repo: Repository for user stats data access.
        """
        self.learning_activity_repo = learning_activity_repo
        self.course_map_repo = course_map_repo
        self.user_stats_repo = user_stats_repo

    async def record_activity(
        self,
        user_id: UUID,
        course_map_id: UUID,
        node_id: int,
        activity_type: str,
        extra_data: dict | None = None,
    ) -> LearningActivity:
        """Record a new learning activity.

        Args:
            user_id: The authenticated user's ID.
            course_map_id: The course map this activity belongs to.
            node_id: The DAG node ID.
            activity_type: Type of activity (node_completed | quiz_passed | knowledge_card_finished).
            extra_data: Optional extra data (e.g., score, time_spent_seconds).

        Returns:
            The created LearningActivity instance.

        Raises:
            ValueError: If activity_type is not valid.
        """
        if activity_type not in VALID_ACTIVITY_TYPES:
            raise ValueError(
                f"Invalid activity_type '{activity_type}'. "
                f"Must be one of: {', '.join(VALID_ACTIVITY_TYPES)}"
            )

        activity = LearningActivity(
            user_id=user_id,
            course_map_id=course_map_id,
            node_id=node_id,
            activity_type=activity_type,
            completed_at=datetime.now(timezone.utc),
            extra_data=extra_data,
        )

        await self.learning_activity_repo.create(activity)

        logger.info(
            "Recorded learning activity",
            user_id=str(user_id),
            course_map_id=str(course_map_id),
            node_id=node_id,
            activity_type=activity_type,
        )

        # If node completed, check course completion
        if activity_type == "node_completed":
            await self._check_and_update_course_completion(
                user_id=user_id,
                course_map_id=course_map_id,
            )

        return activity

    async def _check_and_update_course_completion(
        self,
        user_id: UUID,
        course_map_id: UUID,
    ) -> None:
        """Check if course is fully completed and update stats.

        Args:
            user_id: User UUID.
            course_map_id: Course map UUID.
        """
        # 1. Get course DAG structure
        course_map = await self.course_map_repo.find_by_id(course_map_id)

        if not course_map or not course_map.nodes:
            return

        nodes = course_map.nodes

        # 2. Find all learn nodes
        learning_node_ids = {
            node["id"]
            for node in nodes
            if node.get("type") == "learn"
        }

        if not learning_node_ids:
            return

        # 3. Query completed nodes
        completed_node_ids = await self.learning_activity_repo.find_completed_node_ids(
            user_id=user_id,
            course_map_id=course_map_id,
        )

        # 4. Check if all learn nodes are completed
        if learning_node_ids.issubset(completed_node_ids):
            # Check for existing completion marker
            has_marker = await self.learning_activity_repo.find_course_completion_marker(
                user_id=user_id,
                course_map_id=course_map_id,
            )

            if has_marker is None:
                # First completion: insert marker and update stats
                now = datetime.now(timezone.utc)

                completion_marker = LearningActivity(
                    user_id=user_id,
                    course_map_id=course_map_id,
                    node_id=0,
                    activity_type="course_completed",
                    completed_at=now,
                    extra_data={"total_nodes": len(learning_node_ids)},
                )
                await self.learning_activity_repo.create(completion_marker)

                await self.user_stats_repo.upsert_increment_completed_courses(
                    user_id=user_id,
                    now=now,
                )
                await self.user_stats_repo.flush()

                logger.info(
                    "Course completed for the first time, incremented completed_courses_count",
                    user_id=str(user_id),
                    course_map_id=str(course_map_id),
                )

    async def get_user_activities(
        self,
        user_id: UUID,
        days: int,
    ) -> list[dict]:
        """Get user's learning activities for the past N days.

        Returns raw UTC timestamps. Frontend will handle timezone conversion.

        Args:
            user_id: The authenticated user's ID.
            days: Number of days to look back (1-365).

        Returns:
            List of activity dicts with id, course_map_id, node_id, activity_type,
            completed_at (ISO 8601 UTC string), and metadata.
        """
        if not 1 <= days <= 365:
            raise ValueError("days must be between 1 and 365")

        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)

        activities = await self.learning_activity_repo.find_by_user_since(
            user_id=user_id,
            cutoff_date=cutoff_date,
        )

        logger.info(
            "Fetched learning activities",
            user_id=str(user_id),
            days=days,
            count=len(activities),
        )

        return [
            {
                "id": str(activity.id),
                "course_map_id": str(activity.course_map_id),
                "node_id": activity.node_id,
                "activity_type": activity.activity_type,
                "completed_at": activity.completed_at.isoformat(),
                "extra_data": activity.extra_data,
            }
            for activity in activities
        ]

    async def get_course_activities(
        self,
        user_id: UUID,
        course_map_id: UUID,
    ) -> list[dict]:
        """Get all activities for a specific course.

        Args:
            user_id: The authenticated user's ID.
            course_map_id: The course map to query activities for.

        Returns:
            List of activity dicts.
        """
        activities = await self.learning_activity_repo.find_by_user_and_course(
            user_id=user_id,
            course_map_id=course_map_id,
        )

        logger.info(
            "Fetched course activities",
            user_id=str(user_id),
            course_map_id=str(course_map_id),
            count=len(activities),
        )

        return [
            {
                "id": str(activity.id),
                "course_map_id": str(activity.course_map_id),
                "node_id": activity.node_id,
                "activity_type": activity.activity_type,
                "completed_at": activity.completed_at.isoformat(),
                "extra_data": activity.extra_data,
            }
            for activity in activities
        ]
