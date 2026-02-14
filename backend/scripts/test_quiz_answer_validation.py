"""Test script for quiz answer validation and retry mechanism.

This script tests the enhanced quiz generation validation that checks
for missing answers and retries with error feedback.
"""

import asyncio
import json
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import Settings
from app.core.exceptions import LLMValidationError
from app.domain.services.quiz_service import QuizService
from app.llm.client import LLMClient


async def test_quiz_answer_validation() -> None:
    """Test quiz generation with answer validation."""
    # Use mock LLM for testing
    settings = Settings(
        database_url="postgresql+asyncpg://test:test@localhost/test",
        litellm_model="gpt-4o-mini",
        litellm_base_url="https://api.openai.com/v1",
        litellm_api_key="test-key",
        supabase_url="https://test.supabase.co",
        mock_llm=True,  # Use mock responses
    )

    llm_client = LLMClient(settings)
    quiz_service = QuizService(llm_client)

    # Test with valid mock data (should pass)
    print("=" * 80)
    print("Test 1: Valid quiz generation (using mock)")
    print("=" * 80)

    learned_topics = [
        {
            "topic_name": "Python Variables",
            "pages_markdown": """## Variables
Variables are containers for storing data values.""",
        }
    ]

    try:
        result = await quiz_service.generate_quiz(
            language="en",
            mode="Fast",
            learned_topics=learned_topics,
        )
        print("✅ Quiz generated successfully!")
        print(f"Title: {result['title']}")
        print(f"Questions: {len(result['questions'])}")

        # Check all questions have answers
        questions = result["questions"]
        missing_count = 0
        for idx, q in enumerate(questions):
            qtype = q.get("qtype")
            has_answer = False

            if qtype == "single":
                has_answer = "answer" in q
            elif qtype == "multi":
                has_answer = "answers" in q or "answer" in q
            elif qtype == "boolean":
                has_answer = "answer" in q

            if not has_answer:
                print(f"⚠️  Question {idx + 1} missing answer!")
                missing_count += 1
            else:
                print(f"✅ Question {idx + 1} has answer")

        if missing_count == 0:
            print("\n✅ All questions have required answer fields!")
        else:
            print(f"\n❌ {missing_count} questions missing answers")

    except LLMValidationError as e:
        print(f"❌ Validation failed: {e.message}")
        print(f"Details: {e.details}")

    # Test the _check_missing_answers function directly
    print("\n" + "=" * 80)
    print("Test 2: Testing _check_missing_answers function")
    print("=" * 80)

    test_questions = [
        {
            "qtype": "single",
            "prompt": "What is 2+2?",
            "options": ["3", "4", "5"],
            "answer": "4",  # Has answer - OK
        },
        {
            "qtype": "single",
            "prompt": "What is 3+3?",
            "options": ["5", "6", "7"],
            # Missing answer - should be detected
        },
        {
            "qtype": "multi",
            "prompt": "Select even numbers",
            "options": ["1", "2", "3", "4"],
            "answers": ["2", "4"],  # Has answers - OK
        },
        {
            "qtype": "multi",
            "prompt": "Select odd numbers",
            "options": ["1", "2", "3", "4"],
            # Missing answers - should be detected
        },
        {
            "qtype": "boolean",
            "prompt": "Python is a programming language",
            # Missing answer - should be detected
        },
    ]

    issues = quiz_service._check_missing_answers(test_questions)
    print(f"Found {len(issues)} issues:")
    for issue in issues:
        print(f"  - Question {issue['question_index'] + 1}: {issue['issue']}")
        print(f"    Type: {issue['qtype']}")
        print(f"    Prompt: {issue['prompt']}")

    expected_issues = 3  # Questions 2, 4, 5 should have issues
    if len(issues) == expected_issues:
        print(f"\n✅ Correctly detected {expected_issues} missing answers!")
    else:
        print(f"\n❌ Expected {expected_issues} issues but found {len(issues)}")

    # Test the error formatting
    print("\n" + "=" * 80)
    print("Test 3: Testing error message formatting")
    print("=" * 80)

    test_error = LLMValidationError(
        message="Quiz questions missing required answer fields",
        details={"missing_answers": issues},
    )

    formatted_message = quiz_service._format_error_message_for_retry(test_error)
    print("Formatted error message for LLM retry:")
    print("-" * 80)
    print(formatted_message)
    print("-" * 80)

    print("\n✅ All tests completed!")


if __name__ == "__main__":
    asyncio.run(test_quiz_answer_validation())
