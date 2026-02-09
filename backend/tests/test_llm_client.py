"""Tests for LLM client."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.config import Settings
from app.core.exceptions import LLMValidationError
from app.llm import LLMClient, OutputFormat


def _create_mock_settings(mock_llm: bool = True) -> Settings:
    """Create settings for testing."""
    return Settings(
        database_url="postgresql+asyncpg://test:test@localhost/test",
        litellm_model="test-model",
        litellm_base_url="http://test-api.local",
        litellm_api_key="test-key",
        mock_llm=mock_llm,
        llm_timeout=30,
        llm_max_retries=2,
    )


class TestMockMode:
    """Tests for mock mode functionality."""

    @pytest.mark.asyncio
    async def test_mock_mode_no_network(self) -> None:
        """Mock mode should not make any network requests."""
        settings = _create_mock_settings(mock_llm=True)
        client = LLMClient(settings)

        # Patch litellm to ensure it's never called
        with patch("app.llm.client.litellm.acompletion") as mock_acompletion:
            response = await client.complete(
                prompt_name="test_prompt",
                prompt_text="This is a test",
                output_format=OutputFormat.JSON,
            )

            # Verify litellm was never called
            mock_acompletion.assert_not_called()

            # Verify response is valid
            assert response.success is True
            assert response.prompt_name == "test_prompt"
            assert response.parsed_data == {"mock": True, "type": "test_prompt"}
            assert response.model == "test-model"

    @pytest.mark.asyncio
    async def test_mock_mode_returns_correct_json(self) -> None:
        """Mock mode should return valid JSON for JSON format."""
        settings = _create_mock_settings(mock_llm=True)
        client = LLMClient(settings)

        # Use generic prompt name to test default JSON mock behavior
        # (onboarding has special mock handling for the state machine)
        response = await client.complete(
            prompt_name="generic_json_test",
            prompt_text="Test prompt",
            output_format=OutputFormat.JSON,
        )

        assert response.success is True
        assert isinstance(response.parsed_data, dict)
        assert response.parsed_data["mock"] is True
        assert response.parsed_data["type"] == "generic_json_test"

    @pytest.mark.asyncio
    async def test_mock_mode_returns_correct_yaml(self) -> None:
        """Mock mode should return valid YAML for YAML format."""
        settings = _create_mock_settings(mock_llm=True)
        client = LLMClient(settings)

        # Use generic prompt name to test default YAML mock behavior
        # (dag and onboarding have special mock handling)
        response = await client.complete(
            prompt_name="generic_yaml_test",
            prompt_text="Test prompt",
            output_format=OutputFormat.YAML,
        )

        assert response.success is True
        assert isinstance(response.parsed_data, dict)
        assert response.parsed_data["mock"] is True
        assert response.parsed_data["type"] == "generic_yaml_test"

    @pytest.mark.asyncio
    async def test_mock_mode_returns_correct_markdown(self) -> None:
        """Mock mode should return valid markdown for MARKDOWN format."""
        settings = _create_mock_settings(mock_llm=True)
        client = LLMClient(settings)

        response = await client.complete(
            prompt_name="knowledge_card",
            prompt_text="Test prompt",
            output_format=OutputFormat.MARKDOWN,
        )

        assert response.success is True
        assert isinstance(response.parsed_data, str)
        assert "knowledge_card" in response.parsed_data
        assert len(response.parsed_data) >= 10


class TestValidation:
    """Tests for output validation."""

    @pytest.mark.asyncio
    async def test_json_validation_failure_triggers_retry(self) -> None:
        """JSON validation failure should trigger retry."""
        settings = _create_mock_settings(mock_llm=False)
        settings = Settings(
            database_url=settings.database_url,
            litellm_model=settings.litellm_model,
            litellm_base_url=settings.litellm_base_url,
            litellm_api_key=settings.litellm_api_key,
            mock_llm=False,
            llm_timeout=30,
            llm_max_retries=2,
        )
        client = LLMClient(settings)

        # Create mock response that returns invalid JSON first, then valid JSON
        call_count = 0

        async def mock_acompletion(*args, **kwargs):
            nonlocal call_count
            call_count += 1

            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]

            if call_count == 1:
                # First call returns invalid JSON
                mock_response.choices[0].message.content = "not valid json"
            else:
                # Subsequent calls return valid JSON
                mock_response.choices[0].message.content = '{"valid": true}'

            return mock_response

        with patch("app.llm.client.litellm.acompletion", side_effect=mock_acompletion):
            response = await client.complete(
                prompt_name="test_retry",
                prompt_text="Return JSON",
                output_format=OutputFormat.JSON,
            )

            # Should have retried and succeeded
            assert response.success is True
            assert response.retries == 1  # One retry after initial failure
            assert response.parsed_data == {"valid": True}
            assert call_count == 2  # Initial + 1 retry

    @pytest.mark.asyncio
    async def test_yaml_validation_success(self) -> None:
        """YAML validation should succeed with valid YAML."""
        settings = _create_mock_settings(mock_llm=False)
        settings = Settings(
            database_url=settings.database_url,
            litellm_model=settings.litellm_model,
            litellm_base_url=settings.litellm_base_url,
            litellm_api_key=settings.litellm_api_key,
            mock_llm=False,
            llm_timeout=30,
            llm_max_retries=2,
        )
        client = LLMClient(settings)

        # Create mock response with valid YAML
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "name: test\nvalue: 42"

        with patch("app.llm.client.litellm.acompletion", return_value=mock_response):
            response = await client.complete(
                prompt_name="test_yaml",
                prompt_text="Return YAML",
                output_format=OutputFormat.YAML,
            )

            assert response.success is True
            assert response.retries == 0
            assert response.parsed_data == {"name": "test", "value": 42}

    @pytest.mark.asyncio
    async def test_validation_exhausts_retries(self) -> None:
        """Should raise error after exhausting all retries."""
        settings = Settings(
            database_url="postgresql+asyncpg://test:test@localhost/test",
            litellm_model="test-model",
            litellm_base_url="http://test-api.local",
            litellm_api_key="test-key",
            mock_llm=False,
            llm_timeout=30,
            llm_max_retries=1,  # Only 1 retry
        )
        client = LLMClient(settings)

        # Always return invalid JSON
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "always invalid"

        with patch("app.llm.client.litellm.acompletion", return_value=mock_response):
            with pytest.raises(LLMValidationError):
                await client.complete(
                    prompt_name="test_exhaust",
                    prompt_text="Return JSON",
                    output_format=OutputFormat.JSON,
                )


class TestPromptHash:
    """Tests for prompt hash calculation."""

    @pytest.mark.asyncio
    async def test_prompt_hash_is_consistent(self) -> None:
        """Same prompt should produce same hash."""
        settings = _create_mock_settings(mock_llm=True)
        client = LLMClient(settings)

        response1 = await client.complete(
            prompt_name="test",
            prompt_text="Same prompt text",
            output_format=OutputFormat.TEXT,
        )

        response2 = await client.complete(
            prompt_name="test",
            prompt_text="Same prompt text",
            output_format=OutputFormat.TEXT,
        )

        assert response1.prompt_hash == response2.prompt_hash

    @pytest.mark.asyncio
    async def test_different_prompts_have_different_hashes(self) -> None:
        """Different prompts should produce different hashes."""
        settings = _create_mock_settings(mock_llm=True)
        client = LLMClient(settings)

        response1 = await client.complete(
            prompt_name="test",
            prompt_text="First prompt",
            output_format=OutputFormat.TEXT,
        )

        response2 = await client.complete(
            prompt_name="test",
            prompt_text="Second prompt",
            output_format=OutputFormat.TEXT,
        )

        assert response1.prompt_hash != response2.prompt_hash


class TestResponseMetadata:
    """Tests for response metadata."""

    @pytest.mark.asyncio
    async def test_response_has_all_fields(self) -> None:
        """Response should have all required fields."""
        settings = _create_mock_settings(mock_llm=True)
        client = LLMClient(settings)

        response = await client.complete(
            prompt_name="test_fields",
            prompt_text="Test prompt",
            output_format=OutputFormat.TEXT,
        )

        assert response.request_id is not None
        assert len(response.request_id) == 36  # UUID format
        assert response.prompt_name == "test_fields"
        assert len(response.prompt_hash) == 64  # SHA256 hex
        assert response.raw_text is not None
        assert response.success is True
        assert response.retries == 0
        assert response.latency_ms >= 0
        assert response.model == "test-model"
