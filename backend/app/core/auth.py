"""Supabase JWT authentication dependency for FastAPI.

Uses JWKS (JSON Web Key Set) endpoint for asymmetric key verification.
No shared secret needed — public keys are fetched and cached from Supabase.
"""

import time
from uuid import UUID

import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings

# HTTPBearer extracts "Bearer <token>" from Authorization header
_bearer_scheme = HTTPBearer(auto_error=False)

# JWKS client with built-in caching (re-fetches when keys rotate)
_jwks_client: PyJWKClient | None = None
_jwks_client_created_at: float = 0.0
# Re-create JWKS client every 30 minutes to pick up key rotations
_JWKS_CLIENT_TTL_SECONDS = 1800


def _get_jwks_client() -> PyJWKClient:
    """Get or create JWKS client with TTL-based refresh.

    Returns:
        Configured PyJWKClient pointing to Supabase JWKS endpoint.
    """
    global _jwks_client, _jwks_client_created_at

    now = time.monotonic()
    if _jwks_client is None or (now - _jwks_client_created_at) > _JWKS_CLIENT_TTL_SECONDS:
        settings = get_settings()
        jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True)
        _jwks_client_created_at = now

    return _jwks_client


def _decode_supabase_token(token: str) -> dict:
    """Decode and verify a Supabase JWT using JWKS public key.

    Args:
        token: Raw JWT string from Authorization header.

    Returns:
        Decoded token payload.

    Raises:
        HTTPException: If token is invalid or expired.
    """
    try:
        # Fetch the signing key from JWKS endpoint based on token's "kid" header
        jwks_client = _get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256", "EdDSA"],
            audience="authenticated",
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "TOKEN_EXPIRED", "message": "Token has expired"},
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": f"Invalid token: {e}"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_ERROR", "message": f"Authentication failed: {e}"},
        )


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> UUID:
    """FastAPI dependency: extract and validate user_id from Supabase JWT.

    Usage:
        @router.post("/some-endpoint")
        async def endpoint(user_id: UUID = Depends(get_current_user_id)):
            ...

    Returns:
        The authenticated user's UUID.

    Raises:
        HTTPException 401: If no token or invalid token.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "NOT_AUTHENTICATED", "message": "Authorization header missing"},
        )

    payload = _decode_supabase_token(credentials.credentials)

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Token missing 'sub' claim"},
        )

    try:
        return UUID(sub)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Token 'sub' is not a valid UUID"},
        )


async def get_optional_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> UUID | None:
    """FastAPI dependency: optionally extract user_id from JWT.

    Returns None if no token is provided (for backward-compatible endpoints).
    Still validates the token if one is present.

    Returns:
        The authenticated user's UUID, or None if no token.
    """
    if credentials is None:
        return None

    payload = _decode_supabase_token(credentials.credentials)

    sub = payload.get("sub")
    if not sub:
        return None

    try:
        return UUID(sub)
    except ValueError:
        return None
