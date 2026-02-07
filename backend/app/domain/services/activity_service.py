"""Activity service for tracking user learning history.

This module provides business logic for recording and retrieving
learning activities for the activity heatmap feature.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.domain.models.course_map import CourseMap
from app.domain.models.learning_activity import LearningActivity
from app.domain.models.user_stats import UserStats

logger = get_logger(__name__)

# Valid activity types
VALID_ACTIVITY_TYPES = {"node_completed", "quiz_passed", "knowledge_card_finished", "course_completed", "node_in_progress"}


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

        # 如果是节点完成活动，检查课程是否已全部完成
        if activity_type == "node_completed" and db is not None:
            await ActivityService._check_and_update_course_completion(
                user_id=user_id,
                course_map_id=course_map_id,
                db=db,
            )

        return activity
    
    @staticmethod
    async def _check_and_update_course_completion(
        user_id: UUID,
        course_map_id: UUID,
        db: AsyncSession,
    ) -> None:
        """检查课程是否已全部完成，如果是则更新 completed_courses_count。
        
        课程完成条件：所有 learn 和 boss 类型节点都有对应的 node_completed 活动记录。
        
        通过插入 activity_type="course_completed" 标记来避免重复计数。
        
        Args:
            user_id: 用户 ID
            course_map_id: 课程 ID
            db: 数据库会话
        """
        # 1. 获取课程 DAG 结构
        course_stmt = select(CourseMap).where(CourseMap.id == course_map_id)
        course_result = await db.execute(course_stmt)
        course_map = course_result.scalar_one_or_none()
        
        if not course_map or not course_map.nodes:
            return
        
        nodes = course_map.nodes
        
        # 2. 找出所有 learn 和 boss 节点
        learning_node_ids = {
            node["id"] 
            for node in nodes 
            if node.get("type") in ("learn", "boss")
        }
        
        if not learning_node_ids:
            return
        
        # 3. 查询该用户在该课程中已完成的节点
        completed_stmt = select(LearningActivity.node_id).where(
            LearningActivity.user_id == user_id,
            LearningActivity.course_map_id == course_map_id,
            LearningActivity.activity_type == "node_completed",
        ).distinct()
        completed_result = await db.execute(completed_stmt)
        completed_node_ids = {row[0] for row in completed_result.fetchall()}
        
        # 4. 判断是否全部完成
        if learning_node_ids.issubset(completed_node_ids):
            # 检查是否已经有 "course_completed" 标记（避免重复计数）
            course_completion_marker_stmt = select(LearningActivity).where(
                LearningActivity.user_id == user_id,
                LearningActivity.course_map_id == course_map_id,
                LearningActivity.activity_type == "course_completed",
            )
            marker_result = await db.execute(course_completion_marker_stmt)
            has_marker = marker_result.scalar_one_or_none() is not None
            
            if not has_marker:
                # 首次完成该课程，插入标记并更新计数
                now = datetime.now(timezone.utc)
                
                # 插入 course_completed 标记
                completion_marker = LearningActivity(
                    user_id=user_id,
                    course_map_id=course_map_id,
                    node_id=0,  # 课程级别标记，不关联具体节点
                    activity_type="course_completed",
                    completed_at=now,
                    extra_data={"total_nodes": len(learning_node_ids)},
                )
                db.add(completion_marker)
                
                # 更新 completed_courses_count
                upsert_stmt = pg_insert(UserStats).values(
                    user_id=user_id,
                    total_study_seconds=0,
                    completed_courses_count=1,
                    mastered_nodes_count=0,
                    updated_at=now,
                )
                upsert_stmt = upsert_stmt.on_conflict_do_update(
                    constraint="user_stats_pkey",
                    set_={
                        "completed_courses_count": UserStats.completed_courses_count + 1,
                        "updated_at": now,
                    },
                )
                await db.execute(upsert_stmt)
                await db.flush()
                
                logger.info(
                    "Course completed for the first time, incremented completed_courses_count",
                    user_id=str(user_id),
                    course_map_id=str(course_map_id),
                )
    
    @staticmethod
    async def _increment_mastered_nodes(user_id: UUID, db: AsyncSession) -> None:
        """增加已掌握节点数（每完成一个 node 就增加 1）。
        
        Args:
            user_id: 用户 ID
            db: 数据库会话
        """
        now = datetime.now(timezone.utc)
        upsert_stmt = pg_insert(UserStats).values(
            user_id=user_id,
            total_study_seconds=0,
            completed_courses_count=0,
            mastered_nodes_count=1,
            updated_at=now,
        )
        upsert_stmt = upsert_stmt.on_conflict_do_update(
            constraint="user_stats_pkey",
            set_={
                "mastered_nodes_count": UserStats.mastered_nodes_count + 1,
                "updated_at": now,
            },
        )
        await db.execute(upsert_stmt)
        await db.flush()

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
