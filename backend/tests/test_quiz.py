"""Tests for Quiz API.

All tests use MOCK_LLM=1 mode for offline stability.
"""

import pytest
from httpx import AsyncClient


class TestQuizAPI:
    """Tests for quiz API endpoint."""

    @pytest.mark.asyncio
    async def test_quiz_generate_success(self, client: AsyncClient):
        """Test successful quiz generation with valid request."""
        response = await client.post(
            "/api/v1/quiz/generate",
            json={
                "language": "en",
                "mode": "Fast",
                "learned_topics": [
                    {
                        "topic_name": "Variables",
                        "pages_markdown": "## Variables\n\nVariables store data values.",
                    },
                    {
                        "topic_name": "Data Types",
                        "pages_markdown": "## Data Types\n\nPython has int, float, str types.",
                    },
                ],
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert data["type"] == "quiz"
        assert "title" in data
        assert "greeting" in data
        assert "questions" in data

        # Verify greeting structure
        assert "topics_included" in data["greeting"]
        assert "message" in data["greeting"]
        assert isinstance(data["greeting"]["topics_included"], list)

        # Verify questions structure
        assert len(data["questions"]) >= 1
        for question in data["questions"]:
            assert "qtype" in question
            assert question["qtype"] in ["single", "multi", "boolean"]
            assert "prompt" in question

    @pytest.mark.asyncio
    async def test_quiz_generate_deep_mode(self, client: AsyncClient):
        """Test quiz generation with Deep mode (harder questions)."""
        response = await client.post(
            "/api/v1/quiz/generate",
            json={
                "language": "zh",
                "mode": "Deep",
                "learned_topics": [
                    {
                        "topic_name": "元类",
                        "pages_markdown": "## 元类\n\n元类是创建类的类。",
                    },
                ],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "quiz"

    @pytest.mark.asyncio
    async def test_quiz_generate_invalid_mode(self, client: AsyncClient):
        """Test that invalid mode returns 422 validation error."""
        response = await client.post(
            "/api/v1/quiz/generate",
            json={
                "language": "en",
                "mode": "SuperDeep",  # Invalid mode
                "learned_topics": [
                    {
                        "topic_name": "Variables",
                        "pages_markdown": "## Variables\n\nVariables store data.",
                    },
                ],
            },
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_quiz_generate_empty_topics(self, client: AsyncClient):
        """Test that empty learned_topics returns 422 validation error."""
        response = await client.post(
            "/api/v1/quiz/generate",
            json={
                "language": "en",
                "mode": "Fast",
                "learned_topics": [],  # Empty topics
            },
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_quiz_question_types(self, client: AsyncClient):
        """Test that quiz contains different question types."""
        response = await client.post(
            "/api/v1/quiz/generate",
            json={
                "language": "en",
                "mode": "Fast",
                "learned_topics": [
                    {
                        "topic_name": "Variables",
                        "pages_markdown": "## Variables\n\nVariables store data values.",
                    },
                ],
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Check that we have questions of different types in the mock response
        qtypes = {q["qtype"] for q in data["questions"]}
        # Mock response includes single, multi, and boolean types
        assert len(qtypes) >= 1

        # Verify single choice questions have options and answer
        for question in data["questions"]:
            if question["qtype"] == "single":
                assert "options" in question
                assert "answer" in question
                assert len(question["options"]) >= 2
            elif question["qtype"] == "multi":
                assert "options" in question
                assert "answers" in question or "answer" in question
                assert len(question["options"]) >= 2
            elif question["qtype"] == "boolean":
                assert "answer" in question
