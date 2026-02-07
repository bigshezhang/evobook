"""Activity service for tracking user learning history.

This module provides business logic for recording and retrieving
learning activities for the activity heatmap feature.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.domain.models.learning_activity import LearningActivity

logger = get_logger(__name__)

# Valid activity types
VALID_ACTIVITY_TYPES = {"node_completed", "quiz_passed", "knowledge_card_finished"}


class ActivityService:
    """Service for managing learning activity history."""

    @staticmethod
    async def record_activity(
        user_id: UUID,
        course_map_id: UUID,
        node_id: int,
        activity_type: str,
        extra_data: dict | None = None,
        db: AsyncSession | None = None,
    ) -> LearningActivity:
        """Record a new learning activity.

        Args:
            user_id: The authenticated user's ID.
            course_map_id: The course map this activity belongs to.
            node_id: The DAG node ID.
            activity_type: Type of activity (node_completed | quiz_passed | knowledge_card_finished).
            extra_data: Optional extra data (e.g., score, time_spent_seconds).
            db: Async database session (if None, assumes caller handles commit).

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

        if db is not None:
            db.add(activity)
            await db.flush()

        logger.info(
            "Recorded learning activity",
            user_id=str(user_id),
            course_map_id=str(course_map_id),
            node_id=node_id,
            activity_type=activity_type,
        )

        return activity

    @staticmethod
    async def get_user_activities(
        user_id: UUID,
        days: int,
        db: AsyncSession,
    ) -> list[dict]:
        """Get user's learning activities for the past N days.

        Returns raw UTC timestamps. Frontend will handle timezone conversion.

        Args:
            user_id: The authenticated user's ID.
            days: Number of days to look back (1-365).
            db: Async database session.

        Returns:
            List of activity dicts with id, course_map_id, node_id, activity_type,
            completed_at (ISO 8601 UTC string), and metadata.
        """
        if not 1 <= days <= 365:
            raise ValueError("days must be between 1 and 365")

        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)

        stmt = (
            select(LearningActivity)
            .where(
                LearningActivity.user_id == user_id,
                LearningActivity.completed_at >= cutoff_date,
            )
            .order_by(LearningActivity.completed_at.desc())
        )

        result = await db.execute(stmt)
        activities = result.scalars().all()

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

    @staticmethod
    async def get_course_activities(
        user_id: UUID,
        course_map_id: UUID,
        db: AsyncSession,
    ) -> list[dict]:
        """Get all activities for a specific course.

        Args:
            user_id: The authenticated user's ID.
            course_map_id: The course map to query activities for.
            db: Async database session.

        Returns:
            List of activity dicts.
        """
        stmt = (
            select(LearningActivity)
            .where(
                LearningActivity.user_id == user_id,
                LearningActivity.course_map_id == course_map_id,
            )
            .order_by(LearningActivity.completed_at.desc())
        )

        result = await db.execute(stmt)
        activities = result.scalars().all()

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
