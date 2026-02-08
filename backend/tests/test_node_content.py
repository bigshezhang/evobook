"""Tests for Node Content APIs.

All tests use MOCK_LLM=1 mode for offline stability.
"""

import pytest
from httpx import AsyncClient


class TestKnowledgeCardAPI:
    """Tests for knowledge card API endpoint."""

    @pytest.mark.asyncio
    async def test_knowledge_card_success(self, client: AsyncClient):
        """Test successful knowledge card generation with valid request."""
        response = await client.post(
            "/api/v1/node-content/knowledge-card",
            json={
                "course": {
                    "course_name": "Python Programming",
                    "course_context": "A beginner-friendly Python course",
                    "topic": "Python 编程",
                    "level": "Beginner",
                    "mode": "Fast",
                },
                "node": {
                    "id": 1,
                    "title": "Variables",
                    "description": "Learn about Python variables",
                    "type": "learn",
                    "estimated_minutes": 16,
                },
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert data["type"] == "knowledge_card"
        assert data["node_id"] == 1
        assert data["totalPagesInCard"] >= 1
        assert "markdown" in data
        assert "yaml" in data

        # Verify markdown contains page break for multi-page content
        if data["totalPagesInCard"] > 1:
            assert "<EVOBK_PAGE_BREAK />" in data["markdown"]
        assert data["type"] == "knowledge_card"
        assert data["node_id"] == 5

    @pytest.mark.asyncio
    async def test_knowledge_card_invalid_level(self, client: AsyncClient):
        """Test that invalid level returns 422 validation error."""
        response = await client.post(
            "/api/v1/node-content/knowledge-card",
            json={
                "course": {
                    "course_name": "Python Programming",
                    "course_context": "A beginner-friendly Python course",
                    "topic": "Python 编程",
                    "level": "Expert",  # Invalid level
                    "mode": "Fast",
                },
                "node": {
                    "id": 1,
                    "title": "Variables",
                    "description": "Learn about Python variables",
                    "type": "learn",
                    "estimated_minutes": 16,
                },
            },
        )

        assert response.status_code == 422


class TestClarificationAPI:
    """Tests for clarification API endpoint."""

    @pytest.mark.asyncio
    async def test_clarification_success_english(self, client: AsyncClient):
        """Test successful clarification in English."""
        response = await client.post(
            "/api/v1/node-content/clarification",
            json={
                "language": "en",
                "user_question_raw": "whats a varible?",
                "page_markdown": "## Variables\n\nVariables store data values.",
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert data["type"] == "clarification"
        assert "corrected_title" in data
        assert "short_answer" in data
        assert len(data["short_answer"]) > 0

    @pytest.mark.asyncio
    async def test_clarification_success_chinese(self, client: AsyncClient):
        """Test successful clarification in Chinese."""
        response = await client.post(
            "/api/v1/node-content/clarification",
            json={
                "language": "zh",
                "user_question_raw": "变量是什么意思",
                "page_markdown": "## 变量\n\n变量用于存储数据值。",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "clarification"

    @pytest.mark.asyncio
    async def test_clarification_invalid_language(self, client: AsyncClient):
        """Test that invalid language returns 422 validation error."""
        response = await client.post(
            "/api/v1/node-content/clarification",
            json={
                "language": "fr",  # Invalid language
                "user_question_raw": "What is a variable?",
                "page_markdown": "## Variables\n\nVariables store data values.",
            },
        )

        assert response.status_code == 422


class TestQADetailAPI:
    """Tests for QA detail API endpoint."""

    @pytest.mark.asyncio
    async def test_qa_detail_success(self, client: AsyncClient):
        """Test successful QA detail generation."""
        response = await client.post(
            "/api/v1/node-content/qa-detail",
            json={
                "language": "en",
                "qa_title": "What is variable assignment?",
                "qa_short_answer": "Variable assignment uses the = operator to store values.",
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert data["type"] == "qa_detail"
        assert "title" in data
        assert "body_markdown" in data
        assert "image" in data

        # Verify image structure
        assert "placeholder" in data["image"]
        assert "prompt" in data["image"]
        assert len(data["image"]["placeholder"]) > 0
        assert len(data["image"]["prompt"]) > 0

    @pytest.mark.asyncio
    async def test_qa_detail_chinese(self, client: AsyncClient):
        """Test QA detail generation in Chinese."""
        response = await client.post(
            "/api/v1/node-content/qa-detail",
            json={
                "language": "zh",
                "qa_title": "什么是变量赋值？",
                "qa_short_answer": "变量赋值使用 = 操作符来存储值。",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "qa_detail"
        assert "image" in data
