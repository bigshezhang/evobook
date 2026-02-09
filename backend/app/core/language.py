"""Language detection and utilities.

This module provides language detection from Accept-Language headers
and a FastAPI dependency for injecting the resolved language into endpoints.
"""

from fastapi import Request

# Supported language codes (ISO 639-1)
SUPPORTED_LANGUAGES = {"en", "zh"}
DEFAULT_LANGUAGE = "en"


def parse_accept_language(header: str | None) -> str:
    """Parse Accept-Language header and return the best supported language.

    Follows RFC 7231 simplified parsing: splits by comma, extracts language
    tags, checks against supported languages, returns the first match.

    Args:
        header: Raw Accept-Language header value, e.g. "zh-CN,zh;q=0.9,en;q=0.8".

    Returns:
        Best matching language code from SUPPORTED_LANGUAGES, or DEFAULT_LANGUAGE.
    """
    if not header:
        return DEFAULT_LANGUAGE

    # Split by comma, strip whitespace
    parts = [p.strip() for p in header.split(",")]

    # Parse each part: "zh-CN;q=0.9" -> ("zh-CN", 0.9)
    candidates: list[tuple[str, float]] = []
    for part in parts:
        segments = part.split(";")
        lang_tag = segments[0].strip()
        quality = 1.0
        for seg in segments[1:]:
            seg = seg.strip()
            if seg.startswith("q="):
                try:
                    quality = float(seg[2:])
                except ValueError:
                    quality = 0.0
        candidates.append((lang_tag, quality))

    # Sort by quality descending
    candidates.sort(key=lambda x: x[1], reverse=True)

    # Find the first supported language
    for lang_tag, _ in candidates:
        # Extract primary language subtag: "zh-CN" -> "zh", "en-US" -> "en"
        primary = lang_tag.split("-")[0].lower()
        if primary in SUPPORTED_LANGUAGES:
            return primary

    return DEFAULT_LANGUAGE


def get_language(request: Request) -> str:
    """FastAPI dependency: resolve language from Accept-Language header.

    Usage in endpoint::

        @router.post("/example")
        async def example(language: str = Depends(get_language)):
            ...

    Args:
        request: FastAPI Request object.

    Returns:
        Resolved language code (ISO 639-1).
    """
    header = request.headers.get("Accept-Language")
    return parse_accept_language(header)
