"""Pytest configuration and fixtures."""

import os
from collections.abc import AsyncGenerator
from typing import Generator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Load .env file first, then override DATABASE_URL for test database
from dotenv import load_dotenv
load_dotenv()

# Override to use test database (replace db name in URL)
_base_url = os.environ.get("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/evobook")
os.environ["DATABASE_URL"] = _base_url.rsplit("/", 1)[0] + "/evobook_test"
os.environ.setdefault("LITELLM_MODEL", "gemini-3-flash-preview")
os.environ.setdefault("LITELLM_BASE_URL", "http://test-api.local")
os.environ.setdefault("LITELLM_API_KEY", "test-key")
os.environ.setdefault("LOG_LEVEL", "DEBUG")
os.environ.setdefault("MOCK_LLM", "1")

from app.infrastructure.database import Base, get_db_session
from app.main import app


@pytest.fixture(scope="session")
def event_loop_policy():
    """Use default event loop policy."""
    import asyncio
    return asyncio.DefaultEventLoopPolicy()


@pytest.fixture(scope="session")
def test_database_url() -> str:
    """Get test database URL."""
    return os.environ["DATABASE_URL"]


@pytest.fixture(scope="function")
async def db_engine(test_database_url: str):
    """Create a test database engine."""
    engine = create_async_engine(
        test_database_url,
        echo=False,
        pool_pre_ping=True,
    )

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Drop all tables after test
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture(scope="function")
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session with transaction rollback."""
    session_factory = async_sessionmaker(
        bind=db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )

    async with session_factory() as session:
        yield session
        # Rollback any uncommitted changes
        await session.rollback()


@pytest.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create a test HTTP client with database session override."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db_session] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
async def client_no_db() -> AsyncGenerator[AsyncClient, None]:
    """Create a test HTTP client without database override (for health checks)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
