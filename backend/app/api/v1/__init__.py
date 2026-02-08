"""API v1 router aggregation."""

from fastapi import APIRouter

from app.api.v1.course_map import router as course_map_router
from app.api.v1.discovery import router as discovery_router
from app.api.v1.game import router as game_router
from app.api.v1.health import router as health_router
from app.api.v1.inventory import router as inventory_router
from app.api.v1.invite import router as invite_router
from app.api.v1.learning_session import router as learning_session_router
from app.api.v1.node_content import router as node_content_router
from app.api.v1.node_progress import router as node_progress_router
from app.api.v1.onboarding import router as onboarding_router
from app.api.v1.profile import router as profile_router
from app.api.v1.quiz import router as quiz_router
from app.api.v1.shop import router as shop_router

router = APIRouter(prefix="/api/v1")

router.include_router(health_router, tags=["health"])
router.include_router(discovery_router)
router.include_router(onboarding_router)
router.include_router(course_map_router)
router.include_router(node_content_router)
router.include_router(node_progress_router)
router.include_router(profile_router)
router.include_router(quiz_router)
router.include_router(learning_session_router)
router.include_router(game_router)
router.include_router(shop_router)
router.include_router(inventory_router)
router.include_router(invite_router)
