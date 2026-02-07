"""API v1 router aggregation."""

from fastapi import APIRouter

from app.api.v1.course_map import router as course_map_router
from app.api.v1.health import router as health_router
from app.api.v1.node_content import router as node_content_router
from app.api.v1.node_progress import router as node_progress_router
from app.api.v1.onboarding import router as onboarding_router
from app.api.v1.profile import router as profile_router
from app.api.v1.quiz import router as quiz_router

router = APIRouter(prefix="/api/v1")

router.include_router(health_router, tags=["health"])
router.include_router(onboarding_router)
router.include_router(course_map_router)
router.include_router(node_content_router)
router.include_router(node_progress_router)
router.include_router(profile_router)
router.include_router(quiz_router)
