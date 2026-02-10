"""FastAPI middleware for request logging and error handling.

Uses pure ASGI middleware instead of BaseHTTPMiddleware to avoid
a known Starlette 0.27 bug where BaseHTTPMiddleware can swallow
HTTPException and convert it into a generic 500 response.
"""

import time
import uuid

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.error_codes import ERROR_INTERNAL
from app.core.exceptions import AppException, ErrorDetail, ErrorResponse

logger = structlog.get_logger(__name__)


class RequestLoggingMiddleware:
    """Pure ASGI middleware for request/response logging with request_id.

    Avoids BaseHTTPMiddleware to prevent exception-handling bugs in
    Starlette < 0.36.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        request_id = str(uuid.uuid4())
        start_time = time.perf_counter()

        # Bind request_id to structlog context
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        # Attach request_id to scope state so handlers can read it
        if "state" not in scope:
            scope["state"] = {}
        scope["state"]["request_id"] = request_id

        status_code: int | None = None

        async def send_wrapper(message: dict) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message.get("status", 0)
                # Inject X-Request-ID header
                headers = list(message.get("headers", []))
                headers.append((b"x-request-id", request_id.encode()))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception as e:
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            method = scope.get("method", "?")
            path = scope.get("path", "?")
            logger.error(
                "Request failed with unhandled exception",
                endpoint=f"{method} {path}",
                latency_ms=latency_ms,
                error=str(e),
                exc_info=True,
            )
            raise

        latency_ms = int((time.perf_counter() - start_time) * 1000)
        method = scope.get("method", "?")
        path = scope.get("path", "?")
        logger.info(
            "Request completed",
            endpoint=f"{method} {path}",
            status_code=status_code,
            latency_ms=latency_ms,
        )


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
