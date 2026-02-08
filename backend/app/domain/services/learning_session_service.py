"""Learning session service for tracking study time via heartbeats.

This module provides business logic for processing learning heartbeats
and managing accumulated study time per node.
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.domain.models.course_map import CourseMap
from app.domain.models.learning_activity import LearningActivity
from app.domain.models.user_stats import UserStats

logger = get_logger(__name__)

# 心跳间隔（秒）
HEARTBEAT_INTERVAL_SECONDS = 30


class LearningSessionService:
    """学习会话服务，处理心跳包和学习时长统计。"""

    @staticmethod
    async def process_heartbeat(
        user_id: UUID,
        course_map_id: UUID,
        node_id: int,
        db: AsyncSession,
    ) -> dict:
        """处理学习心跳包。

        业务逻辑：
        1. 校验 course_map 是否存在且属于该用户
        2. 从 course_map.dag_structure 中校验 node 是否存在
        3. 检查该 node 累计时长是否超限（estimated_minutes * 2）
        4. 原子性更新 user_stats.total_study_seconds += 30（使用 ON CONFLICT UPSERT）
        5. 更新该 node 的累计时长到 learning_activities.extra_data
        6. 返回 acknowledged + total_study_seconds

        Args:
            user_id: 用户 ID
            course_map_id: 课程 ID
            node_id: 节点 ID
            db: 数据库会话

        Returns:
            {
                "acknowledged": bool,
                "total_study_seconds": int,
                "reason": str | None  # 如果 acknowledged=False
            }
        """
        # 1. 校验课程是否存在且属于该用户
        course_stmt = select(CourseMap).where(
            CourseMap.id == course_map_id,
            CourseMap.user_id == user_id,
        )
        course_result = await db.execute(course_stmt)
        course_map = course_result.scalar_one_or_none()

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

        # 2. 校验 node 是否存在于 DAG 中
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

        # 3. 获取该 node 的累计时长和预估时长
        estimated_minutes = target_node.get("estimated_minutes", 0)
        time_limit_seconds = estimated_minutes * 2 * 60  # 超限阈值：2 倍预估时长

        accumulated_seconds = await LearningSessionService.get_node_accumulated_seconds(
            user_id=user_id,
            course_map_id=course_map_id,
            node_id=node_id,
            db=db,
        )

        if accumulated_seconds >= time_limit_seconds > 0:
            # 超限，不再计入学习时长
            logger.info(
                "Heartbeat acknowledged but not counted: time limit reached",
                user_id=str(user_id),
                course_map_id=str(course_map_id),
                node_id=node_id,
                accumulated_seconds=accumulated_seconds,
                time_limit_seconds=time_limit_seconds,
            )
            # 返回当前总时长（不增加）
            stats_stmt = select(UserStats).where(UserStats.user_id == user_id)
            stats_result = await db.execute(stats_stmt)
            stats = stats_result.scalar_one_or_none()
            current_total = stats.total_study_seconds if stats else 0

            return {
                "acknowledged": False,
                "total_study_seconds": current_total,
                "reason": "TIME_LIMIT_REACHED",
            }

        # 4. 原子性更新 user_stats.total_study_seconds += 30
        now = datetime.now(tz=timezone.utc)
        upsert_stmt = pg_insert(UserStats).values(
            user_id=user_id,
            total_study_seconds=HEARTBEAT_INTERVAL_SECONDS,
            completed_courses_count=0,
            mastered_nodes_count=0,
            updated_at=now,
        )
        upsert_stmt = upsert_stmt.on_conflict_do_update(
            constraint="user_stats_pkey",
            set_={
                "total_study_seconds": UserStats.total_study_seconds + HEARTBEAT_INTERVAL_SECONDS,
                "updated_at": now,
            },
        )
        await db.execute(upsert_stmt)

        # 5. 更新该 node 的累计时长
        await LearningSessionService.update_node_accumulated_time(
            user_id=user_id,
            course_map_id=course_map_id,
            node_id=node_id,
            seconds_to_add=HEARTBEAT_INTERVAL_SECONDS,
            db=db,
        )

        await db.commit()

        # 6. 获取更新后的总时长
        stats_stmt = select(UserStats).where(UserStats.user_id == user_id)
        stats_result = await db.execute(stats_stmt)
        stats = stats_result.scalar_one()

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

    @staticmethod
    async def get_node_accumulated_seconds(
        user_id: UUID,
        course_map_id: UUID,
        node_id: int,
        db: AsyncSession,
    ) -> int:
        """获取用户在某个 node 的累计学习时长（秒）。

        从 learning_activities 表的 extra_data.accumulated_seconds 读取。
        如果没有记录，返回 0。

        Args:
            user_id: 用户 ID
            course_map_id: 课程 ID
            node_id: 节点 ID
            db: 数据库会话

        Returns:
            累计学习时长（秒）
        """
        stmt = select(LearningActivity).where(
            LearningActivity.user_id == user_id,
            LearningActivity.course_map_id == course_map_id,
            LearningActivity.node_id == node_id,
            LearningActivity.activity_type == "node_in_progress",
        )
        result = await db.execute(stmt)
        activity = result.scalar_one_or_none()

        if not activity or not activity.extra_data:
            return 0

        return activity.extra_data.get("accumulated_seconds", 0)

    @staticmethod
    async def update_node_accumulated_time(
        user_id: UUID,
        course_map_id: UUID,
        node_id: int,
        seconds_to_add: int,
        db: AsyncSession,
    ) -> None:
        """更新某个 node 的累计学习时长。

        如果该 node 还没有 learning_activity 记录（用户尚未完成），
        创建一个 activity_type="node_in_progress" 的记录。

        更新 extra_data = {"accumulated_seconds": old_value + seconds_to_add}

        Args:
            user_id: 用户 ID
            course_map_id: 课程 ID
            node_id: 节点 ID
            seconds_to_add: 要增加的秒数
            db: 数据库会话
        """
        now = datetime.now(tz=timezone.utc)

        # 查找现有记录
        stmt = select(LearningActivity).where(
            LearningActivity.user_id == user_id,
            LearningActivity.course_map_id == course_map_id,
            LearningActivity.node_id == node_id,
            LearningActivity.activity_type == "node_in_progress",
        )
        result = await db.execute(stmt)
        activity = result.scalar_one_or_none()

        if activity:
            # 更新现有记录
            current_seconds = activity.extra_data.get("accumulated_seconds", 0) if activity.extra_data else 0
            new_seconds = current_seconds + seconds_to_add
            activity.extra_data = {"accumulated_seconds": new_seconds}
            activity.completed_at = now  # 更新最后活跃时间
        else:
            # 创建新记录
            activity = LearningActivity(
                user_id=user_id,
                course_map_id=course_map_id,
                node_id=node_id,
                activity_type="node_in_progress",
                completed_at=now,
                extra_data={"accumulated_seconds": seconds_to_add},
            )
            db.add(activity)

        await db.flush()
