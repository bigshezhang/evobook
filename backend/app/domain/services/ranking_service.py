"""Ranking service for calculating user global rank based on study time.

This module provides business logic for computing user rankings
and percentiles based on total study time.
"""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.domain.models.user_stats import UserStats

logger = get_logger(__name__)


class RankingService:
    """排名服务，计算用户全局排名。"""

    @staticmethod
    async def get_user_rank(user_id: UUID, db: AsyncSession) -> dict:
        """计算用户的全局排名。

        排名规则：
        - 按 total_study_seconds 降序排序
        - 相同时长的用户排名相同
        - 排名从 1 开始

        Args:
            user_id: 用户 ID
            db: 数据库会话

        Returns:
            {
                "global_rank": int | None,  # 排名（从 1 开始），如果用户无统计数据则为 None
                "rank_percentile": int | None,  # 百分位（0-100），如果用户无统计数据则为 None
                "total_users": int  # 系统中有学习时长统计的总用户数
            }
        """
        # 1. 获取该用户的学习时长
        user_stmt = select(UserStats).where(UserStats.user_id == user_id)
        user_result = await db.execute(user_stmt)
        user_stats = user_result.scalar_one_or_none()

        # 2. 获取系统中有统计数据的总用户数
        count_stmt = select(func.count()).select_from(UserStats)
        count_result = await db.execute(count_stmt)
        total_users = count_result.scalar()

        if not user_stats or total_users == 0:
            logger.info(
                "User rank calculation: user has no stats",
                user_id=str(user_id),
                total_users=total_users,
            )
            return {
                "global_rank": None,
                "rank_percentile": None,
                "total_users": total_users,
            }

        user_study_seconds = user_stats.total_study_seconds

        # 3. 计算有多少用户的学习时长大于当前用户（即排名更高）
        rank_stmt = select(func.count()).select_from(UserStats).where(
            UserStats.total_study_seconds > user_study_seconds
        )
        rank_result = await db.execute(rank_stmt)
        users_ahead = rank_result.scalar()

        # 当前用户的排名 = 排名更高的用户数 + 1
        global_rank = users_ahead + 1

        # 4. 计算百分位：百分位 = (total_users - rank + 1) / total_users * 100
        # 例如：总共 100 人，排名第 10，百分位 = (100 - 10 + 1) / 100 * 100 = 91
        # 即：超过了 91% 的用户
        rank_percentile = int(((total_users - global_rank + 1) / total_users) * 100)

        logger.info(
            "User rank calculated",
            user_id=str(user_id),
            global_rank=global_rank,
            rank_percentile=rank_percentile,
            total_users=total_users,
            study_seconds=user_study_seconds,
        )

        return {
            "global_rank": global_rank,
            "rank_percentile": rank_percentile,
            "total_users": total_users,
        }
