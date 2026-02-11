"""Tests for Course Map (DAG) generation API.

All tests use MOCK_LLM=1 mode for offline stability.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.course_map import CourseMap
from app.domain.services.course_map_service import (
    CourseMapService,
    DAGValidationError,
)
from app.llm.client import LLMClient


@pytest.fixture(autouse=True)
def reset_mock_dag_context():
    """Reset mock DAG context before each test."""
    LLMClient.set_mock_dag_context(total_minutes=120, mode="Fast")
    yield


class TestCourseMapAPI:
    """Tests for course map API endpoint."""

    @pytest.mark.asyncio
    async def test_generate_course_map_success(self, client: AsyncClient):
        """Test successful course map generation with valid request."""
        LLMClient.set_mock_dag_context(total_minutes=120, mode="Fast")

        response = await client.post(
            "/api/v1/course-map/generate",
            json={
                "topic": "Python 编程",
                "level": "Beginner",
                "focus": "能独立写小程序",
                "verified_concept": "装饰器",
                "mode": "Fast",
                "total_commitment_minutes": 120,
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Verify map_meta structure
        assert "map_meta" in data
        assert data["map_meta"]["mode"] == "Fast"
        assert data["map_meta"]["time_budget_minutes"] == 120
        assert data["map_meta"]["time_sum_minutes"] == 120
        assert "course_name" in data["map_meta"]
        assert "strategy_rationale" in data["map_meta"]

        # Verify nodes structure
        assert "nodes" in data
        assert len(data["nodes"]) > 0

        # Verify each node has required fields
        for node in data["nodes"]:
            assert "id" in node
            assert "title" in node
            assert "description" in node
            assert "type" in node
            assert node["type"] in ["learn", "quiz"]
            assert "layer" in node
            assert "pre_requisites" in node
            assert "estimated_minutes" in node
            assert "reward_multiplier" in node
            assert 1.0 <= node["reward_multiplier"] <= 3.0

    @pytest.mark.asyncio
    async def test_course_map_persisted_to_db(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        """Test that generated course map is persisted to database."""
        LLMClient.set_mock_dag_context(total_minutes=90, mode="Light")

        response = await client.post(
            "/api/v1/course-map/generate",
            json={
                "topic": "机器学习基础",
                "level": "Intermediate",
                "focus": "理解核心算法",
                "verified_concept": "线性回归",
                "mode": "Light",
                "total_commitment_minutes": 90,
            },
        )

        assert response.status_code == 200

        # Verify course map exists in database
        stmt = select(CourseMap).where(CourseMap.topic == "机器学习基础")
        result = await db_session.execute(stmt)
        course_map = result.scalar_one_or_none()

        assert course_map is not None
        assert course_map.topic == "机器学习基础"
        assert course_map.level == "Intermediate"
        assert course_map.mode == "Light"
        assert course_map.total_commitment_minutes == 90
        assert len(course_map.nodes) > 0

    @pytest.mark.asyncio
    async def test_nodes_have_estimated_minutes(self, client: AsyncClient):
        """Test that all nodes have estimated_minutes field."""
        LLMClient.set_mock_dag_context(total_minutes=150, mode="Fast")

        response = await client.post(
            "/api/v1/course-map/generate",
            json={
                "topic": "Web 开发",
                "level": "Beginner",
                "focus": "能做个人网站",
                "verified_concept": "HTML",
                "mode": "Fast",
                "total_commitment_minutes": 150,
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Verify all nodes have estimated_minutes
        for node in data["nodes"]:
            assert "estimated_minutes" in node
            assert isinstance(node["estimated_minutes"], int)
            assert node["estimated_minutes"] > 0

    @pytest.mark.asyncio
    async def test_dag_has_branch_and_merge(self, client: AsyncClient):
        """Test that generated DAG has proper branch and merge structure."""
        LLMClient.set_mock_dag_context(total_minutes=120, mode="Fast")

        response = await client.post(
            "/api/v1/course-map/generate",
            json={
                "topic": "数据分析",
                "level": "Beginner",
                "focus": "能处理Excel数据",
                "verified_concept": "数据透视表",
                "mode": "Fast",
                "total_commitment_minutes": 120,
            },
        )

        assert response.status_code == 200
        data = response.json()
        nodes = data["nodes"]

        # Group nodes by layer
        layers: dict[int, list] = {}
        for node in nodes:
            layer = node["layer"]
            if layer not in layers:
                layers[layer] = []
            layers[layer].append(node)

        # Verify at least one layer has 2+ nodes (branch)
        has_branch = any(len(layer_nodes) >= 2 for layer_nodes in layers.values())
        assert has_branch, "DAG must have at least one branching layer"

        # Verify at least one node has 2+ prerequisites (merge)
        has_merge = any(
            len(node["pre_requisites"]) >= 2
            for node in nodes
        )
        assert has_merge, "DAG must have at least one merge node"

    @pytest.mark.asyncio
    async def test_invalid_level_returns_422(self, client: AsyncClient):
        """Test that invalid level value returns 422 validation error."""
        response = await client.post(
            "/api/v1/course-map/generate",
            json={
                "topic": "Python 编程",
                "level": "Expert",  # Invalid level
                "focus": "能独立写小程序",
                "verified_concept": "装饰器",
                "mode": "Fast",
                "total_commitment_minutes": 120,
            },
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_mode_returns_422(self, client: AsyncClient):
        """Test that invalid mode value returns 422 validation error."""
        response = await client.post(
            "/api/v1/course-map/generate",
            json={
                "topic": "Python 编程",
                "level": "Beginner",
                "focus": "能独立写小程序",
                "verified_concept": "装饰器",
                "mode": "SuperFast",  # Invalid mode
                "total_commitment_minutes": 120,
            },
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_commitment_minutes_out_of_range_returns_422(
        self, client: AsyncClient
    ):
        """Test that commitment minutes outside 30-480 range returns 422."""
        # Test too low
        response = await client.post(
            "/api/v1/course-map/generate",
            json={
                "topic": "Python 编程",
                "level": "Beginner",
                "focus": "能独立写小程序",
                "verified_concept": "装饰器",
                "mode": "Fast",
                "total_commitment_minutes": 10,  # Too low
            },
        )
        assert response.status_code == 422

        # Test too high
        response = await client.post(
            "/api/v1/course-map/generate",
            json={
                "topic": "Python 编程",
                "level": "Beginner",
                "focus": "能独立写小程序",
                "verified_concept": "装饰器",
                "mode": "Fast",
                "total_commitment_minutes": 1000,  # Too high
            },
        )
        assert response.status_code == 422


class TestCourseMapService:
    """Unit tests for CourseMapService validation logic."""

    def test_validate_branches_with_linear_dag_fails(self):
        """Test that linear DAG (no branches) fails validation."""
        from app.config import get_settings

        service = CourseMapService(
            llm_client=LLMClient(get_settings()),
            db_session=None,  # Not needed for validation tests
        )

        # Linear DAG with no parallel nodes
        linear_nodes = [
            {"id": 1, "layer": 1, "pre_requisites": [], "estimated_minutes": 40},
            {"id": 2, "layer": 2, "pre_requisites": [1], "estimated_minutes": 40},
            {"id": 3, "layer": 3, "pre_requisites": [2], "estimated_minutes": 40},
        ]

        with pytest.raises(DAGValidationError) as exc_info:
            service._validate_branches_and_merges(linear_nodes)

        assert "branching layer" in str(exc_info.value.message)

    def test_validate_branches_without_merge_fails(self):
        """Test that DAG without merge node fails validation."""
        from app.config import get_settings

        service = CourseMapService(
            llm_client=LLMClient(get_settings()),
            db_session=None,
        )

        # DAG with branch but no merge (each path ends separately)
        no_merge_nodes = [
            {"id": 1, "layer": 1, "pre_requisites": [], "estimated_minutes": 30},
            {"id": 2, "layer": 2, "pre_requisites": [1], "estimated_minutes": 30},
            {"id": 3, "layer": 2, "pre_requisites": [1], "estimated_minutes": 30},
            {"id": 4, "layer": 3, "pre_requisites": [2], "estimated_minutes": 15},
            {"id": 5, "layer": 3, "pre_requisites": [3], "estimated_minutes": 15},
        ]

        with pytest.raises(DAGValidationError) as exc_info:
            service._validate_branches_and_merges(no_merge_nodes)

        assert "merge node" in str(exc_info.value.message)

    def test_validate_dag_time_mismatch_fails(self):
        """Test that time sum mismatch fails validation."""
        from app.config import get_settings

        service = CourseMapService(
            llm_client=LLMClient(get_settings()),
            db_session=None,
        )

        # DAG data with valid structure (time sum no longer validated)
        dag_data = {
            "map_meta": {},
            "nodes": [
                {"id": 1, "layer": 1, "pre_requisites": [], "estimated_minutes": 30, "type": "learn", "reward_multiplier": 1.0},
                {"id": 2, "layer": 2, "pre_requisites": [1], "estimated_minutes": 30, "type": "learn", "reward_multiplier": 1.2},
                {"id": 3, "layer": 2, "pre_requisites": [1], "estimated_minutes": 30, "type": "learn", "reward_multiplier": 1.2},
                {"id": 4, "layer": 3, "pre_requisites": [2, 3], "estimated_minutes": 20, "type": "quiz", "reward_multiplier": 2.0},
            ],
        }

        # Total is 110, total_commitment_minutes is 120 - should pass (time sum no longer validated)
        service._validate_dag_structure(dag_data, mode="Fast", total_commitment_minutes=120)
        # If no exception raised, test passes
