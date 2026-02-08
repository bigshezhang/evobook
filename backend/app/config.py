"""Application configuration with environment variable validation."""

import sys
from functools import lru_cache

from pydantic import Field, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables.
    
    Required variables will cause startup failure if missing.
    """
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )
    
    # Required
    database_url: str = Field(
        ...,
        description="Postgres connection string (postgresql+asyncpg://...)",
    )
    
    # LiteLLM
    litellm_model: str = Field(
        ...,
        description="LiteLLM model identifier (e.g., gemini-3-flash-preview)",
    )
    litellm_base_url: str = Field(
        ...,
        description="LiteLLM API base URL",
    )
    litellm_api_key: str = Field(
        ...,
        description="LiteLLM API key",
    )
    
    # Optional
    log_level: str = Field(
        default="INFO",
        description="Logging level",
    )
    
    # Supabase Auth
    supabase_url: str = Field(
        ...,
        description="Supabase project URL (e.g. https://xxxx.supabase.co)",
    )
    
    # Frontend/App Base URL for invite links
    app_base_url: str = Field(
        default="https://evobook.app",
        description="Frontend base URL for generating invite links (e.g. https://evobook.app or http://localhost:3000 for local dev)",
    )
    
    # LLM Client settings
    mock_llm: bool = Field(
        default=False,
        description="Enable mock mode for testing",
    )
    llm_timeout: int = Field(
        default=60,
        description="LLM request timeout in seconds",
    )
    llm_max_retries: int = Field(
        default=2,
        description="Max retries for LLM requests",
    )


@lru_cache
def get_settings() -> Settings:
    """Get cached application settings.
    
    Raises:
        SystemExit: If required environment variables are missing.
    """
    try:
        return Settings()  # type: ignore[call-arg]
    except ValidationError as e:
        print("ERROR: Missing required environment variables:", file=sys.stderr)
        for error in e.errors():
            field = error["loc"][0]
            print(f"  - {str(field).upper()}: {error['msg']}", file=sys.stderr)
        sys.exit(1)
