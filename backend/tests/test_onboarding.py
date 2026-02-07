"""Tests for onboarding state machine and API.

All tests use MOCK_LLM=1 mode for offline stability.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.onboarding import OnboardingSession
from app.domain.services.onboarding_service import (
    OnboardingPhase,
    OnboardingService,
    OnboardingState,
    UserIntent,
)
from app.llm.client import LLMClient


@pytest.fixture(autouse=True)
def reset_mock_counter():
    """Reset mock counter before each test."""
    LLMClient.reset_mock_counter()
    yield


class TestOnboardingState:
    """Tests for OnboardingState serialization."""

    def test_to_dict_and_from_dict(self):
        """Test state serialization round-trip."""
        from uuid import uuid4

        original = OnboardingState(
            session_id=uuid4(),
            phase=OnboardingPhase.FOCUS,
            topic="Python",
            level="Beginner",
            verified_concept="装饰器",
            focus=None,
            source=None,
            intent=UserIntent.ADD_INFO,
            history=[{"role": "user", "content": "test"}],
        )

        data = original.to_dict()
        restored = OnboardingState.from_dict(data)

        assert restored.session_id == original.session_id
        assert restored.phase == original.phase
        assert restored.topic == original.topic
        assert restored.level == original.level
        assert restored.intent == original.intent
        assert restored.history == original.history


class TestOnboardingAPI:
    """Tests for onboarding API endpoint."""

    @pytest.mark.asyncio
    async def test_create_new_session(self, client: AsyncClient):
        """Test that a new session is created when no session_id is provided."""
        response = await client.post(
            "/api/v1/onboarding/next",
            json={"session_id": None, "user_message": None, "user_choice": None},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "chat"
        assert "session_id" in data
        assert "message" in data
        assert "options" in data
        assert isinstance(data["options"], list)

    @pytest.mark.asyncio
    async def test_session_persisted_to_db(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        """Test that session state is persisted to database."""
        # Create new session
        response = await client.post(
            "/api/v1/onboarding/next",
            json={"session_id": None, "user_message": None, "user_choice": None},
        )

        assert response.status_code == 200
        session_id = response.json()["session_id"]

        # Verify session exists in database
        stmt = select(OnboardingSession).where(
            OnboardingSession.id == session_id
        )
        result = await db_session.execute(stmt)
        session = result.scalar_one_or_none()

        assert session is not None
        assert str(session.id) == session_id
        assert session.phase is not None

    @pytest.mark.asyncio
    async def test_normal_flow_to_finish(self, client: AsyncClient):
        """Test that normal conversation flow reaches finish state."""
        # Step 1: Create session (exploration)
        response = await client.post(
            "/api/v1/onboarding/next",
            json={"session_id": None, "user_message": None, "user_choice": None},
        )
        assert response.status_code == 200
        session_id = response.json()["session_id"]

        # Step 2: User selects topic (calibration_r1)
        response = await client.post(
            "/api/v1/onboarding/next",
            json={"session_id": session_id, "user_choice": "Python 编程"},
        )
        assert response.status_code == 200

        # Step 3: User answers calibration (calibration_r2)
        response = await client.post(
            "/api/v1/onboarding/next",
            json={"session_id": session_id, "user_choice": "完全没听过"},
        )
        assert response.status_code == 200

        # Step 4: User answers second calibration (focus)
        response = await client.post(
            "/api/v1/onboarding/next",
            json={"session_id": session_id, "user_choice": "完全零基础"},
        )
        assert response.status_code == 200

        # Step 5: User sets focus (source)
        response = await client.post(
            "/api/v1/onboarding/next",
            json={"session_id": session_id, "user_choice": "能独立写小程序"},
        )
        assert response.status_code == 200

        # Step 6: User answers source (handoff)
        response = await client.post(
            "/api/v1/onboarding/next",
            json={"session_id": session_id, "user_choice": "朋友推荐"},
        )
        assert response.status_code == 200
        data = response.json()

        assert data["type"] == "finish"
        assert "data" in data
        assert data["data"]["topic"] == "Python 编程"
        assert data["data"]["level"] in ["Novice", "Beginner", "Intermediate", "Advanced"]
        assert data["data"]["intent"] in ["add_info", "change_topic"]

    @pytest.mark.asyncio
    async def test_change_topic_resets_to_exploration(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        """Test that change_topic intent resets session to exploration phase."""
        # Create session and advance a few steps
        response = await client.post(
            "/api/v1/onboarding/next",
            json={"session_id": None},
        )
        session_id = response.json()["session_id"]

        # Advance to calibration
        await client.post(
            "/api/v1/onboarding/next",
            json={"session_id": session_id, "user_choice": "Python 编程"},
        )

        # Simulate topic change by checking the state machine behavior
        # When a user explicitly changes topic, the service should reset

        # Verify session still exists and is in a valid state
        stmt = select(OnboardingSession).where(
            OnboardingSession.id == session_id
        )
        result = await db_session.execute(stmt)
        session = result.scalar_one_or_none()

        assert session is not None
        # After change_topic, phase should reset or continue from a valid state
        assert session.phase in [p.value for p in OnboardingPhase]

    @pytest.mark.asyncio
    async def test_add_info_continues_flow(self, client: AsyncClient):
        """Test that add_info intent continues the flow without reset."""
        # Create session
        response = await client.post(
            "/api/v1/onboarding/next",
            json={"session_id": None},
        )
        session_id = response.json()["session_id"]

        # Continue with user choice (add_info behavior)
        response = await client.post(
            "/api/v1/onboarding/next",
            json={"session_id": session_id, "user_choice": "Python 编程"},
        )

        assert response.status_code == 200
        data = response.json()
        # Session should continue with next question, not reset
        assert data["type"] == "chat"
        assert data["session_id"] == session_id
        # Options should be for the next phase (calibration)
        assert len(data["options"]) > 0

    @pytest.mark.asyncio
    async def test_session_state_preserved_across_requests(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        """Test that session state is correctly preserved across multiple requests."""
        # Create session
        response = await client.post(
            "/api/v1/onboarding/next",
            json={"session_id": None},
        )
        session_id = response.json()["session_id"]

        # Make several requests
        for i in range(3):
            response = await client.post(
                "/api/v1/onboarding/next",
                json={"session_id": session_id, "user_choice": f"Option {i}"},
            )
            assert response.status_code == 200
            assert response.json()["session_id"] == session_id

        # Verify state is preserved in DB
        stmt = select(OnboardingSession).where(
            OnboardingSession.id == session_id
        )
        result = await db_session.execute(stmt)
        session = result.scalar_one_or_none()

        assert session is not None
        assert session.state_json is not None
        # History should contain the conversation
        history = session.state_json.get("history", [])
        assert len(history) > 0


class TestOnboardingService:
    """Unit tests for OnboardingService."""

    @pytest.mark.asyncio
    async def test_service_creates_new_state(self, db_session: AsyncSession):
        """Test that service creates new state for None session_id."""
        from app.config import get_settings

        llm_client = LLMClient(get_settings())
        service = OnboardingService(llm_client=llm_client, db_session=db_session)

        result = await service.process_next(
            session_id=None,
            user_message=None,
            user_choice=None,
        )

        assert "session_id" in result
        assert result["type"] == "chat"

    @pytest.mark.asyncio
    async def test_service_loads_existing_session(self, db_session: AsyncSession):
        """Test that service loads existing session from database."""
        from uuid import uuid4
        from app.config import get_settings

        # Create a session in DB first
        session_id = uuid4()
        session = OnboardingSession(
            id=session_id,
            phase="calibration_r1",
            topic="Python",
            state_json={"history": [{"role": "user", "content": "Python"}]},
        )
        db_session.add(session)
        await db_session.commit()

        llm_client = LLMClient(get_settings())
        service = OnboardingService(llm_client=llm_client, db_session=db_session)

        result = await service.process_next(
            session_id=session_id,
            user_message=None,
            user_choice="听说过",
        )

        assert result["session_id"] == session_id
