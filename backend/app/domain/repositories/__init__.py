"""Domain repositories package.

Provides data access abstractions for all domain entities,
isolating SQLAlchemy queries from the service layer.
"""

from app.domain.repositories.base import BaseRepository
from app.domain.repositories.course_map_repository import CourseMapRepository
from app.domain.repositories.discovery_course_repository import DiscoveryCourseRepository
from app.domain.repositories.game_transaction_repository import GameTransactionRepository
from app.domain.repositories.invite_repository import InviteRepository
from app.domain.repositories.learning_activity_repository import LearningActivityRepository
from app.domain.repositories.node_content_repository import NodeContentRepository
from app.domain.repositories.node_progress_repository import NodeProgressRepository
from app.domain.repositories.onboarding_repository import OnboardingRepository
from app.domain.repositories.profile_repository import ProfileRepository
from app.domain.repositories.quiz_attempt_repository import QuizAttemptRepository
from app.domain.repositories.shop_item_repository import ShopItemRepository
from app.domain.repositories.user_inventory_repository import UserInventoryRepository
from app.domain.repositories.user_stats_repository import UserStatsRepository

__all__ = [
    "BaseRepository",
    "CourseMapRepository",
    "DiscoveryCourseRepository",
    "GameTransactionRepository",
    "InviteRepository",
    "LearningActivityRepository",
    "NodeContentRepository",
    "NodeProgressRepository",
    "OnboardingRepository",
    "ProfileRepository",
    "QuizAttemptRepository",
    "ShopItemRepository",
    "UserInventoryRepository",
    "UserStatsRepository",
]
