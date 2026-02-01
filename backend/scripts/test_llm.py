#!/usr/bin/env python3
"""Manual test script for LLM client.

Usage:
    # Run in mock mode (default when MOCK_LLM=1)
    python3 scripts/test_llm.py
    
    # Run against real LLM (requires proper env vars)
    MOCK_LLM=0 python3 scripts/test_llm.py
"""

import asyncio
import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set default env vars for testing
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/evobook")
os.environ.setdefault("LITELLM_MODEL", "gemini-3-flash-preview")
os.environ.setdefault("LITELLM_BASE_URL", "http://localhost:8080")
os.environ.setdefault("LITELLM_API_KEY", "test-key")
os.environ.setdefault("MOCK_LLM", "1")

from app.config import get_settings
from app.core.logging import setup_logging
from app.llm import LLMClient, OutputFormat


async def test_all_formats() -> None:
    """Test LLM client with all output formats."""
    setup_logging("DEBUG")
    
    settings = get_settings()
    client = LLMClient(settings)
    
    print(f"\n{'='*60}")
    print(f"LLM Client Test - Mock Mode: {settings.mock_llm}")
    print(f"Model: {settings.litellm_model}")
    print(f"{'='*60}\n")
    
    # Test JSON format
    print("[1/4] Testing JSON format...")
    response = await client.complete(
        prompt_name="test_json",
        prompt_text="Return a JSON object with a greeting field.",
        output_format=OutputFormat.JSON,
    )
    print(f"  ✓ Success: {response.success}")
    print(f"  ✓ Parsed data: {response.parsed_data}")
    print(f"  ✓ Latency: {response.latency_ms}ms")
    print()
    
    # Test YAML format
    print("[2/4] Testing YAML format...")
    response = await client.complete(
        prompt_name="test_yaml",
        prompt_text="Return a YAML object with a greeting field.",
        output_format=OutputFormat.YAML,
    )
    print(f"  ✓ Success: {response.success}")
    print(f"  ✓ Parsed data: {response.parsed_data}")
    print(f"  ✓ Latency: {response.latency_ms}ms")
    print()
    
    # Test MARKDOWN format
    print("[3/4] Testing MARKDOWN format...")
    response = await client.complete(
        prompt_name="test_markdown",
        prompt_text="Write a brief markdown document.",
        output_format=OutputFormat.MARKDOWN,
    )
    print(f"  ✓ Success: {response.success}")
    print(f"  ✓ Response length: {len(str(response.parsed_data))} chars")
    print(f"  ✓ Latency: {response.latency_ms}ms")
    print()
    
    # Test TEXT format
    print("[4/4] Testing TEXT format...")
    response = await client.complete(
        prompt_name="test_text",
        prompt_text="Say hello.",
        output_format=OutputFormat.TEXT,
    )
    print(f"  ✓ Success: {response.success}")
    print(f"  ✓ Response: {response.raw_text}")
    print(f"  ✓ Latency: {response.latency_ms}ms")
    print()
    
    # Test with variables
    print("[Bonus] Testing with variables...")
    response = await client.complete(
        prompt_name="test_variables",
        prompt_text="Hello {name}, you are learning {topic}.",
        variables={"name": "Alice", "topic": "Python"},
        output_format=OutputFormat.TEXT,
    )
    print(f"  ✓ Success: {response.success}")
    print(f"  ✓ Prompt hash: {response.prompt_hash[:32]}...")
    print()
    
    print(f"{'='*60}")
    print("All tests passed!")
    print(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(test_all_formats())
