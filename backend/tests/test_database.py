"""Database connection and model tests."""

from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.onboarding import OnboardingSession
from app.domain.models.prompt_run import PromptRun


@pytest.mark.asyncio
async def test_database_connection(db_session: AsyncSession) -> None:
    """Test database connection is working."""
    result = await db_session.execute(text("SELECT 1"))
    assert result.scalar() == 1


@pytest.mark.asyncio
async def test_create_onboarding_session(db_session: AsyncSession) -> None:
    """Test creating an onboarding session."""
    session = OnboardingSession(
        phase="exploration",
        topic="React",
        state_json={"step": 1},
    )
    
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)
    
    assert session.id is not None
    assert session.phase == "exploration"
    assert session.topic == "React"
    assert session.state_json == {"step": 1}
    assert session.created_at is not None
    assert session.updated_at is not None


@pytest.mark.asyncio
async def test_create_prompt_run(db_session: AsyncSession) -> None:
    """Test creating a prompt run record."""
    request_id = uuid4()
    
    prompt_run = PromptRun(
        request_id=request_id,
        prompt_name="onboarding",
        prompt_hash="abc123def456",
        model="gpt-4o-mini",
        success=True,
        retries=0,
        latency_ms=1500,
        raw_text="Hello world",
        parsed_json={"response": "test"},
    )
    
    db_session.add(prompt_run)
    await db_session.commit()
    await db_session.refresh(prompt_run)
    
    assert prompt_run.id is not None
    assert prompt_run.request_id == request_id
    assert prompt_run.prompt_name == "onboarding"
    assert prompt_run.success is True
    assert prompt_run.latency_ms == 1500


@pytest.mark.asyncio
async def test_onboarding_session_update(db_session: AsyncSession) -> None:
    """Test updating onboarding session fields."""
    session = OnboardingSession(
        phase="exploration",
        state_json={},
    )
    
    db_session.add(session)
    await db_session.commit()
    
    # Update session
    session.phase = "calibration_r1"
    session.topic = "Python"
    session.level = "Beginner"
    
    await db_session.commit()
    await db_session.refresh(session)
    
    assert session.phase == "calibration_r1"
    assert session.topic == "Python"
    assert session.level == "Beginner"
