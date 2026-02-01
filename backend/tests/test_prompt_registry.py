"""Tests for the Prompt Registry."""

import hashlib
import re

import pytest

from app.prompts import PromptName, PromptNotFoundError, PromptRegistry


class TestPromptRegistry:
    """Test suite for PromptRegistry."""

    def setup_method(self) -> None:
        """Clear cache before each test."""
        PromptRegistry.clear_cache()

    def test_load_all_prompts_success(self) -> None:
        """All 6 prompts should load successfully."""
        expected_prompts = [
            PromptName.ONBOARDING,
            PromptName.DAG,
            PromptName.KNOWLEDGE_CARD,
            PromptName.CLARIFICATION,
            PromptName.QA_DETAIL,
            PromptName.QUIZ,
        ]

        for prompt_name in expected_prompts:
            prompt_text = PromptRegistry.get_prompt(prompt_name)
            assert prompt_text is not None
            assert len(prompt_text) > 0
            assert isinstance(prompt_text, str)

    def test_load_prompt_by_string_name(self) -> None:
        """Should be able to load prompts using string names."""
        prompt_text = PromptRegistry.get_prompt("onboarding")
        assert prompt_text is not None
        assert len(prompt_text) > 0

    def test_invalid_name_raises_error(self) -> None:
        """Non-whitelisted names should raise PromptNotFoundError."""
        invalid_names = [
            "invalid_prompt",
            "secret",
            "../secrets",
            "../../etc/passwd",
            "",
            "onboarding.txt",  # Should use "onboarding", not filename
        ]

        for invalid_name in invalid_names:
            with pytest.raises(PromptNotFoundError):
                PromptRegistry.get_prompt(invalid_name)

    def test_prompt_hash_is_sha256(self) -> None:
        """Hash should be a valid 64-character hexadecimal SHA256."""
        prompt_hash = PromptRegistry.get_prompt_hash(PromptName.ONBOARDING)

        # SHA256 produces 64 hex characters
        assert len(prompt_hash) == 64
        # Should be valid hexadecimal
        assert re.match(r"^[a-f0-9]{64}$", prompt_hash) is not None

    def test_same_prompt_same_hash(self) -> None:
        """Same prompt should always produce the same hash."""
        hash1 = PromptRegistry.get_prompt_hash(PromptName.ONBOARDING)
        hash2 = PromptRegistry.get_prompt_hash(PromptName.ONBOARDING)

        assert hash1 == hash2

        # Also verify after clearing cache
        PromptRegistry.clear_cache()
        hash3 = PromptRegistry.get_prompt_hash(PromptName.ONBOARDING)

        assert hash1 == hash3

    def test_hash_matches_content(self) -> None:
        """Hash should match actual SHA256 of content."""
        prompt_text = PromptRegistry.get_prompt(PromptName.DAG)
        expected_hash = hashlib.sha256(prompt_text.encode("utf-8")).hexdigest()
        actual_hash = PromptRegistry.get_prompt_hash(PromptName.DAG)

        assert actual_hash == expected_hash

    def test_path_traversal_blocked(self) -> None:
        """Path traversal attempts should be blocked."""
        # These should all fail because they're not in the whitelist
        path_traversal_attempts = [
            "../__init__.py",
            "../../app/config.py",
            "/etc/passwd",
            "..\\..\\windows\\system32\\config",
            "onboarding/../../../etc/passwd",
        ]

        for attempt in path_traversal_attempts:
            with pytest.raises(PromptNotFoundError):
                PromptRegistry.get_prompt(attempt)

    def test_get_all_prompt_names(self) -> None:
        """Should return all 6 prompt names."""
        names = PromptRegistry.get_all_prompt_names()

        assert len(names) == 6
        assert PromptName.ONBOARDING in names
        assert PromptName.DAG in names
        assert PromptName.KNOWLEDGE_CARD in names
        assert PromptName.CLARIFICATION in names
        assert PromptName.QA_DETAIL in names
        assert PromptName.QUIZ in names

    def test_prompt_caching(self) -> None:
        """Prompts should be cached after first load."""
        # First load
        prompt1 = PromptRegistry.get_prompt(PromptName.QUIZ)

        # Check it's in cache
        assert PromptName.QUIZ in PromptRegistry._cache

        # Second load should return same object (from cache)
        prompt2 = PromptRegistry.get_prompt(PromptName.QUIZ)

        assert prompt1 is prompt2  # Same object reference

    def test_clear_cache(self) -> None:
        """Cache should be clearable."""
        # Load a prompt
        PromptRegistry.get_prompt(PromptName.ONBOARDING)
        assert PromptName.ONBOARDING in PromptRegistry._cache

        # Clear cache
        PromptRegistry.clear_cache()

        assert PromptName.ONBOARDING not in PromptRegistry._cache
        assert len(PromptRegistry._cache) == 0

    def test_get_prompt_with_hash(self) -> None:
        """get_prompt_with_hash should return both text and hash."""
        text, prompt_hash = PromptRegistry.get_prompt_with_hash(PromptName.CLARIFICATION)

        assert len(text) > 0
        assert len(prompt_hash) == 64

        # Verify hash matches
        expected_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
        assert prompt_hash == expected_hash

    def test_different_prompts_different_hashes(self) -> None:
        """Different prompts should have different hashes."""
        hashes = set()
        for name in PromptRegistry.get_all_prompt_names():
            prompt_hash = PromptRegistry.get_prompt_hash(name)
            hashes.add(prompt_hash)

        # All 6 should be unique
        assert len(hashes) == 6

    def test_prompt_name_enum_values(self) -> None:
        """PromptName enum values should match expected strings."""
        assert PromptName.ONBOARDING.value == "onboarding"
        assert PromptName.DAG.value == "dag"
        assert PromptName.KNOWLEDGE_CARD.value == "knowledge_card"
        assert PromptName.CLARIFICATION.value == "clarification"
        assert PromptName.QA_DETAIL.value == "qa_detail"
        assert PromptName.QUIZ.value == "quiz"
