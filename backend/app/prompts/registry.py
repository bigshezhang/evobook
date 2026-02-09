"""Prompt Registry for loading and managing prompt files.

This module provides a secure way to load prompt files from the prompts directory.
It uses a whitelist approach to prevent path traversal attacks.
"""

import hashlib
from enum import Enum
from pathlib import Path


class PromptName(str, Enum):
    """Allowed prompt names (whitelist)."""

    ONBOARDING = "onboarding"
    DAG = "dag"
    KNOWLEDGE_CARD = "knowledge_card"
    CLARIFICATION = "clarification"
    QA_DETAIL = "qa_detail"
    QUIZ = "quiz"


class PromptNotFoundError(Exception):
    """Raised when prompt file is not found or name is not whitelisted."""

    pass


class PromptRegistry:
    """Registry for loading prompt files from app/prompts/*.txt.

    This class provides secure access to prompt files using a whitelist
    approach to prevent path traversal attacks.

    Example:
        >>> prompt = PromptRegistry.get_prompt(PromptName.ONBOARDING)
        >>> prompt_hash = PromptRegistry.get_prompt_hash(PromptName.ONBOARDING)
    """

    PROMPTS_DIR: Path = Path(__file__).parent  # app/prompts/

    # Whitelist mapping: name -> filename
    _WHITELIST: dict[PromptName, str] = {
        PromptName.ONBOARDING: "onboarding.txt",
        PromptName.DAG: "dag.txt",
        PromptName.KNOWLEDGE_CARD: "knowledge_card.txt",
        PromptName.CLARIFICATION: "clarification.txt",
        PromptName.QA_DETAIL: "qa_detail.txt",
        PromptName.QUIZ: "quiz.txt",
    }

    _cache: dict[PromptName, str] = {}  # Cache loaded prompts

    @classmethod
    def get_prompt(cls, name: PromptName | str) -> str:
        """Get prompt text by name.

        Args:
            name: Prompt name (must be in whitelist). Can be a PromptName enum
                  or a string that matches a PromptName value.

        Returns:
            Prompt text content.

        Raises:
            PromptNotFoundError: If prompt name is not whitelisted or file not found.
        """
        # Convert string to enum if needed
        if isinstance(name, str):
            try:
                name = PromptName(name)
            except ValueError:
                raise PromptNotFoundError(f"Prompt '{name}' is not in whitelist")

        # Check cache first
        if name in cls._cache:
            return cls._cache[name]

        # Get filename from whitelist
        filename = cls._WHITELIST.get(name)
        if not filename:
            raise PromptNotFoundError(f"Prompt '{name.value}' is not in whitelist")

        # Build safe path (prevent path traversal)
        file_path = cls.PROMPTS_DIR / filename

        # Verify the resolved path is within PROMPTS_DIR
        try:
            resolved_file_path = file_path.resolve()
            resolved_prompts_dir = cls.PROMPTS_DIR.resolve()
            if not str(resolved_file_path).startswith(str(resolved_prompts_dir)):
                raise PromptNotFoundError(f"Invalid prompt path: {filename}")
        except OSError as e:
            raise PromptNotFoundError(f"Invalid prompt path: {e}")

        # Load file
        if not file_path.exists():
            raise PromptNotFoundError(f"Prompt file not found: {filename}")

        text = file_path.read_text(encoding="utf-8")
        cls._cache[name] = text
        return text

    @classmethod
    def get_prompt_hash(cls, name: PromptName | str) -> str:
        """Get sha256 hash of prompt text.

        Args:
            name: Prompt name (must be in whitelist).

        Returns:
            64-character hexadecimal sha256 hash of the prompt content.

        Raises:
            PromptNotFoundError: If prompt name is not whitelisted or file not found.
        """
        text = cls.get_prompt(name)
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    @classmethod
    def get_all_prompt_names(cls) -> list[PromptName]:
        """Get all available prompt names.

        Returns:
            List of all PromptName enum values.
        """
        return list(cls._WHITELIST.keys())

    @classmethod
    def clear_cache(cls) -> None:
        """Clear the prompt cache.

        This is primarily useful for testing to ensure fresh reads.
        """
        cls._cache.clear()

    @classmethod
    def get_prompt_with_hash(cls, name: PromptName | str) -> tuple[str, str]:
        """Get both prompt text and its hash in one call.

        This is more efficient than calling get_prompt and get_prompt_hash
        separately as it only reads the file once.

        Args:
            name: Prompt name (must be in whitelist).

        Returns:
            Tuple of (prompt_text, prompt_hash).

        Raises:
            PromptNotFoundError: If prompt name is not whitelisted or file not found.
        """
        text = cls.get_prompt(name)
        prompt_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
        return text, prompt_hash
