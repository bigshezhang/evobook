"""Prompt management module for EvoBook.

This module provides secure access to prompt files used by the LLM client.
"""

from app.prompts.registry import PromptName, PromptNotFoundError, PromptRegistry

__all__ = ["PromptName", "PromptNotFoundError", "PromptRegistry"]
