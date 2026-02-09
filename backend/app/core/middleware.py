"""FastAPI middleware for request logging and error handling."""

import time
import uuid
from typing import Callable

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.error_codes import ERROR_INTERNAL
from app.core.exceptions import AppException, ErrorDetail, ErrorResponse

logger = structlog.get_logger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for request/response logging with request_id."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and log with timing."""
        request_id = str(uuid.uuid4())

        # Bind request_id to context for all logs in this request
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        # Store request_id in request state for use in handlers
        request.state.request_id = request_id

        start_time = time.perf_counter()

        try:
            response = await call_next(request)

            latency_ms = int((time.perf_counter() - start_time) * 1000)

            logger.info(
                "Request completed",
                endpoint=f"{request.method} {request.url.path}",
                status_code=response.status_code,
                latency_ms=latency_ms,
            )

            # Add request_id to response headers
            response.headers["X-Request-ID"] = request_id

            return response

        except Exception as e:
            latency_ms = int((time.perf_counter() - start_time) * 1000)

            logger.error(
                "Request failed with unhandled exception",
                endpoint=f"{request.method} {request.url.path}",
                latency_ms=latency_ms,
                error=str(e),
                exc_info=True,
            )
            raise


def setup_exception_handlers(app: FastAPI) -> None:
    """Register global exception handlers."""

    @app.exception_handler(AppException)
    async def app_exception_handler(
        request: Request,
        exc: AppException,
    ) -> JSONResponse:
        """Handle application-specific exceptions."""
        logger.warning(
            "Application error",
            error_code=exc.code,
            error_message=exc.message,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.to_response().model_dump(),
            headers={"X-Request-ID": getattr(request.state, "request_id", "unknown")},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        """Handle Pydantic validation errors."""
        logger.warning(
            "Request validation failed",
            errors=exc.errors(),
        )
        return JSONResponse(
            status_code=422,
            content=ErrorResponse(
                error=ErrorDetail(
                    code="VALIDATION_ERROR",
                    message="Request validation failed",
                    details=exc.errors(),
                )
            ).model_dump(),
            headers={"X-Request-ID": getattr(request.state, "request_id", "unknown")},
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(
        request: Request,
        exc: Exception,
    ) -> JSONResponse:
        """Handle unexpected exceptions."""
        logger.error(
            "Unexpected error",
            error=str(exc),
            exc_info=True,
        )
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                error=ErrorDetail(
                    code=ERROR_INTERNAL,
                    message="An unexpected error occurred",
                    details=None,
                )
            ).model_dump(),
            headers={"X-Request-ID": getattr(request.state, "request_id", "unknown")},
        )
