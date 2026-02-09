"""Application exceptions and error response models."""

from typing import Any

from pydantic import BaseModel

from app.core.error_codes import ERROR_NOT_FOUND


class ErrorDetail(BaseModel):
    """Standard error detail structure."""

    code: str
    message: str
    details: Any | None = None


class ErrorResponse(BaseModel):
    """Standard error response wrapper."""

    error: ErrorDetail


class AppException(Exception):
    """Base application exception."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 500,
        details: Any | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(message)

    def to_response(self) -> ErrorResponse:
        """Convert exception to standard error response."""
        return ErrorResponse(
            error=ErrorDetail(
                code=self.code,
                message=self.message,
                details=self.details,
            )
        )


class ValidationException(AppException):
    """Request validation error."""

    def __init__(self, message: str, details: Any | None = None) -> None:
        super().__init__(
            code="VALIDATION_ERROR",
            message=message,
            status_code=422,
            details=details,
        )


class NotFoundError(AppException):
    """Resource not found error."""

    def __init__(self, resource: str, identifier: str) -> None:
        super().__init__(
            code=ERROR_NOT_FOUND,
            message=f"{resource} not found: {identifier}",
            status_code=404,
        )


class DatabaseError(AppException):
    """Database operation error."""

    def __init__(self, message: str, details: Any | None = None) -> None:
        super().__init__(
            code="DATABASE_ERROR",
            message=message,
            status_code=500,
            details=details,
        )


class LLMError(AppException):
    """LLM API call error."""

    def __init__(self, message: str, details: Any | None = None) -> None:
        super().__init__(
            code="LLM_ERROR",
            message=message,
            status_code=502,
            details=details,
        )


class LLMValidationError(AppException):
    """LLM output validation error."""

    def __init__(self, message: str, details: Any | None = None) -> None:
        super().__init__(
            code="LLM_VALIDATION_ERROR",
            message=message,
            status_code=502,
            details=details,
        )
