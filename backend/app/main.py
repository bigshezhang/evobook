"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import router as v1_router
from app.api.v1.health import router as health_router
from app.config import get_settings
from app.core.logging import setup_logging
from app.core.middleware import RequestLoggingMiddleware, setup_exception_handlers


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan handler for startup/shutdown."""
    # Startup
    settings = get_settings()
    setup_logging(settings.log_level)

    # Import here to avoid circular imports and ensure settings are loaded
    from app.core.logging import get_logger
    logger = get_logger(__name__)
    logger.info(
        "Application starting",
        model=settings.litellm_model,
        log_level=settings.log_level,
    )

    # Execute recovery logic for incomplete content generation tasks
    try:
        from app.domain.services.content_generation_service import ContentGenerationService
        from app.domain.services.recovery_service import RecoveryService
        from app.infrastructure.database import get_session_factory
        from app.llm.client import LLMClient

        logger.info("Starting recovery process for incomplete tasks")

        session_factory = get_session_factory()
        async with session_factory() as db:
            recovery_service = RecoveryService()
            llm_client = LLMClient(settings)

            # Create content generation service for recovery
            content_generation_service = ContentGenerationService(
                llm_client=llm_client,
                db_session=db,
            )

            # Execute recovery
            stats = await recovery_service.recover_incomplete_tasks(
                db=db,
                content_generation_service=content_generation_service,
            )

            logger.info(
                "Recovery completed successfully",
                stats=stats,
            )
    except Exception as e:
        logger.error(
            "Recovery failed during startup",
            error=str(e),
            exc_info=True,
        )
        # Don't block application startup on recovery failure

    yield

    # Shutdown
    logger.info("Application shutting down")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    # Validate settings early (will exit if missing required vars)
    get_settings()

    app = FastAPI(
        title="EvoBook Backend",
        description="EvoBook learning platform backend API",
        version="0.1.0",
        lifespan=lifespan,
    )

    # Add request logging middleware (added first = inner layer)
    app.add_middleware(RequestLoggingMiddleware)

    # Add CORS middleware (added last = outermost layer, so it wraps everything)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Setup exception handlers
    setup_exception_handlers(app)

    # Include routers
    # Health at root level (no /api/v1 prefix)
    app.include_router(health_router, tags=["health"])
    # API v1 routes
    app.include_router(v1_router)

    return app


# Application instance
app = create_app()
