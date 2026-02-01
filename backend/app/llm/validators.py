"""Output validators for LLM responses."""

import json
from enum import Enum

import yaml

from app.core.exceptions import LLMValidationError


class OutputFormat(str, Enum):
    """Supported output formats for LLM responses."""
    
    JSON = "json"
    YAML = "yaml"
    MARKDOWN = "markdown"
    TEXT = "text"


def validate_json(text: str) -> dict:
    """Parse and validate JSON from LLM response.
    
    Args:
        text: Raw text that should contain JSON.
        
    Returns:
        Parsed JSON as dict.
        
    Raises:
        LLMValidationError: If text is not valid JSON or not a dict.
    """
    try:
        # Strip potential markdown code blocks
        clean_text = _strip_code_blocks(text, "json")
        data = json.loads(clean_text)
        if not isinstance(data, dict):
            raise LLMValidationError(
                message="JSON must be an object, not a primitive or array",
                details={"type": type(data).__name__},
            )
        return data
    except json.JSONDecodeError as e:
        raise LLMValidationError(
            message=f"Invalid JSON: {e.msg}",
            details={"line": e.lineno, "column": e.colno},
        ) from e


def validate_yaml(text: str) -> dict:
    """Parse and validate YAML from LLM response.
    
    Args:
        text: Raw text that should contain YAML.
        
    Returns:
        Parsed YAML as dict.
        
    Raises:
        LLMValidationError: If text is not valid YAML or not a dict.
    """
    try:
        # Strip potential markdown code blocks
        clean_text = _strip_code_blocks(text, "yaml")
        data = yaml.safe_load(clean_text)
        if data is None:
            raise LLMValidationError(
                message="YAML is empty or null",
                details=None,
            )
        if not isinstance(data, dict):
            raise LLMValidationError(
                message="YAML must be a mapping, not a scalar or sequence",
                details={"type": type(data).__name__},
            )
        return data
    except yaml.YAMLError as e:
        raise LLMValidationError(
            message=f"Invalid YAML: {e}",
            details=None,
        ) from e


def validate_markdown(text: str, min_length: int = 10) -> str:
    """Validate markdown from LLM response.
    
    Args:
        text: Raw text that should be markdown.
        min_length: Minimum required length (default 10).
        
    Returns:
        Validated markdown text (stripped).
        
    Raises:
        LLMValidationError: If text is empty or too short.
    """
    if not text:
        raise LLMValidationError(
            message="Markdown response is empty",
            details=None,
        )
    
    stripped = text.strip()
    if len(stripped) < min_length:
        raise LLMValidationError(
            message=f"Markdown too short: {len(stripped)} chars (min {min_length})",
            details={"length": len(stripped), "min_length": min_length},
        )
    
    return stripped


def _strip_code_blocks(text: str, lang: str) -> str:
    """Strip markdown code block wrappers if present.
    
    Args:
        text: Text potentially wrapped in code blocks.
        lang: Expected language tag (json, yaml).
        
    Returns:
        Text with code blocks stripped.
    """
    stripped = text.strip()
    
    # Check for ```json or ```yaml at start
    for prefix in [f"```{lang}", "```"]:
        if stripped.startswith(prefix):
            stripped = stripped[len(prefix):]
            break
    
    # Check for ``` at end
    if stripped.endswith("```"):
        stripped = stripped[:-3]
    
    return stripped.strip()
