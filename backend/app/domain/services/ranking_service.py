"""Ranking service for calculating user global rank based on study time.

This module provides business logic for computing user rankings
and percentiles based on total study time.
"""

from uuid import UUID

from app.core.logging import get_logger
from app.domain.repositories.user_stats_repository import UserStatsRepository

logger = get_logger(__name__)


class RankingService:
    """Service for computing user global rank."""

    def __init__(self, user_stats_repo: UserStatsRepository) -> None:
        """Initialize ranking service.

        Args:
            user_stats_repo: Repository for user stats data access.
        """
        self.user_stats_repo = user_stats_repo

    async def get_user_rank(self, user_id: UUID) -> dict:
        """Calculate user's global rank.

        Ranking rules:
        - Sorted by total_study_seconds descending
        - Users with the same study time have the same rank
        - Rank starts from 1

        Args:
            user_id: User UUID.

        Returns:
            Dict with global_rank, rank_percentile, total_users.
        """
        # 1. Get user's study time
        user_stats = await self.user_stats_repo.find_by_user_id(user_id)

        # 2. Get total user count
        total_users = await self.user_stats_repo.count_total_users()

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

        # 3. Count users with more study time
        users_ahead = await self.user_stats_repo.count_users_ahead(user_study_seconds)

        # Current user's rank = users ahead + 1
        global_rank = users_ahead + 1

        # 4. Calculate percentile
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
