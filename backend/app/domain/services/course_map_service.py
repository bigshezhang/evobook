"""Course map generation service.

This module implements the DAG generation logic for learning paths using LLM.
"""

import json
from typing import Any
from uuid import UUID, uuid4

from app.core.exceptions import LLMValidationError, ValidationException
from app.core.logging import get_logger
from app.domain.models.course_map import CourseMap
from app.domain.repositories.course_map_repository import CourseMapRepository
from app.llm.client import LLMClient
from app.llm.validators import OutputFormat
from app.prompts.registry import PromptName, PromptRegistry

logger = get_logger(__name__)


class DAGValidationError(ValidationException):
    """Raised when DAG structure validation fails."""

    def __init__(self, message: str, details: Any | None = None) -> None:
        super().__init__(message=message, details=details)


class CourseMapService:
    """Service for generating and managing course maps (DAGs).

    This service handles:
    1. Calling LLM with DAG prompt and user profile
    2. Validating the DAG structure (branches, merges, time constraints)
    3. Persisting the course map to database
    """

    def __init__(self, llm_client: LLMClient, course_map_repo: CourseMapRepository) -> None:
        """Initialize course map service.

        Args:
            llm_client: LLM client for generating DAG.
            course_map_repo: Repository for course map persistence.
        """
        self.llm = llm_client
        self.course_map_repo = course_map_repo

    async def generate_course_map(
        self,
        topic: str,
        level: str,
        focus: str,
        verified_concept: str,
        mode: str,
        total_commitment_minutes: int,
        user_id: UUID | None = None,
        language: str = "en",
    ) -> dict[str, Any]:
        """Generate a course map DAG using LLM.

        Args:
            topic: Learning topic from onboarding.
            level: User level (Novice|Beginner|Intermediate|Advanced).
            focus: User's learning focus/goal.
            verified_concept: Concept verified during onboarding.
            mode: Learning mode (Deep|Fast|Light).
            total_commitment_minutes: Total time budget.
            user_id: Optional authenticated user ID to associate with the map.
            language: Language code for LLM output (ISO 639-1, e.g. "en", "zh").

        Returns:
            Dict containing course_map_id, map_meta, and nodes.

        Raises:
            DAGValidationError: If DAG structure is invalid.
            LLMValidationError: If LLM response parsing fails.
        """
        logger.info(
            "Generating course map",
            topic=topic,
            level=level,
            mode=mode,
            language=language,
            total_minutes=total_commitment_minutes,
        )

        # Build prompt context
        prompt_text = PromptRegistry.get_prompt(PromptName.DAG)
        context = self._build_context(
            topic=topic,
            level=level,
            focus=focus,
            verified_concept=verified_concept,
            mode=mode,
            total_commitment_minutes=total_commitment_minutes,
            language=language,
        )
        full_prompt = f"{prompt_text}\n\n# User Input\n{context}"

        # Call LLM
        response = await self.llm.complete(
            prompt_name="dag",
            prompt_text=full_prompt,
            output_format=OutputFormat.JSON,
        )

        # Parse and validate response
        dag_data = response.parsed_data
        if not isinstance(dag_data, dict):
            raise LLMValidationError(
                message="LLM returned invalid DAG structure",
                details={"raw_text": response.raw_text[:500]},
            )

        # Validate DAG structure
        self._validate_dag_structure(dag_data, mode, total_commitment_minutes)

        # Persist to database
        course_map = CourseMap(
            id=uuid4(),
            user_id=user_id,
            topic=topic,
            level=level,
            focus=focus,
            verified_concept=verified_concept,
            mode=mode,
            language=language,
            total_commitment_minutes=total_commitment_minutes,
            map_meta=dag_data.get("map_meta", {}),
            nodes=dag_data.get("nodes", []),
        )
        await self.course_map_repo.save(course_map)
        await self.course_map_repo.commit()

        logger.info(
            "Course map generated and saved",
            course_map_id=str(course_map.id),
            node_count=len(dag_data.get("nodes", [])),
            user_id=str(user_id) if user_id else None,
        )

        return {
            "course_map_id": course_map.id,
            "map_meta": dag_data.get("map_meta", {}),
            "nodes": dag_data.get("nodes", []),
        }

    def _build_context(
        self,
        topic: str,
        level: str,
        focus: str,
        verified_concept: str,
        mode: str,
        total_commitment_minutes: int,
        language: str = "en",
    ) -> str:
        """Build context string for DAG prompt.

        Args:
            topic: Learning topic.
            level: User level.
            focus: Learning focus.
            verified_concept: Verified concept.
            mode: Learning mode.
            total_commitment_minutes: Time budget.
            language: Language code for LLM output.

        Returns:
            Formatted context string.
        """
        return json.dumps({
            "language": language,
            "topic": topic,
            "level": level,
            "focus": focus,
            "verified_concept": verified_concept,
            "mode": mode,
            "total_commitment_minutes": total_commitment_minutes,
        }, ensure_ascii=False, indent=2)

    def _validate_dag_structure(
        self,
        dag_data: dict[str, Any],
        mode: str,
        total_commitment_minutes: int,
    ) -> None:
        """Validate DAG structure against hard rules.

        Args:
            dag_data: Parsed DAG data from LLM.
            mode: Learning mode.
            total_commitment_minutes: Expected time budget.

        Raises:
            DAGValidationError: If validation fails.
        """
        nodes = dag_data.get("nodes", [])
        map_meta = dag_data.get("map_meta", {})

        if not nodes:
            raise DAGValidationError(
                message="DAG must have at least one node",
                details={"nodes_count": 0},
            )

        # 1. Validate time sum
        time_sum = sum(node.get("estimated_minutes", 0) for node in nodes)
        if time_sum != total_commitment_minutes:
            raise DAGValidationError(
                message=f"Time sum mismatch: expected {total_commitment_minutes}, got {time_sum}",
                details={
                    "expected": total_commitment_minutes,
                    "actual": time_sum,
                    "delta": total_commitment_minutes - time_sum,
                },
            )

        # 2. Validate reward multipliers
        self._validate_reward_multipliers(nodes)

        # 3. Validate branches and merges
        self._validate_branches_and_merges(nodes)

        # 4. Validate map_meta consistency
        meta_time_sum = map_meta.get("time_sum_minutes")
        meta_time_budget = map_meta.get("time_budget_minutes")
        if meta_time_sum is not None and meta_time_sum != time_sum:
            logger.warning(
                "map_meta.time_sum_minutes inconsistent with actual sum",
                meta_value=meta_time_sum,
                actual_sum=time_sum,
            )
        if meta_time_budget is not None and meta_time_budget != total_commitment_minutes:
            logger.warning(
                "map_meta.time_budget_minutes inconsistent with request",
                meta_value=meta_time_budget,
                request_value=total_commitment_minutes,
            )

    def _validate_reward_multipliers(self, nodes: list[dict[str, Any]]) -> None:
        """Validate that all nodes have valid reward_multiplier values.

        Args:
            nodes: List of DAG nodes.

        Raises:
            DAGValidationError: If any node has invalid or missing reward_multiplier.
        """
        for node in nodes:
            node_id = node.get("id")
            multiplier = node.get("reward_multiplier")

            if multiplier is None:
                raise DAGValidationError(
                    message=f"Node {node_id} missing reward_multiplier",
                    details={"node_id": node_id},
                )

            if not isinstance(multiplier, (int, float)):
                raise DAGValidationError(
                    message=f"Node {node_id} has invalid reward_multiplier type",
                    details={"node_id": node_id, "type": type(multiplier).__name__},
                )

            if not (1.0 <= multiplier <= 3.0):
                raise DAGValidationError(
                    message=f"Node {node_id} reward_multiplier out of range (1.0-3.0)",
                    details={"node_id": node_id, "value": multiplier},
                )

    def _validate_branches_and_merges(self, nodes: list[dict[str, Any]]) -> None:
        """Validate that DAG has proper branch and merge structure.

        Args:
            nodes: List of DAG nodes.

        Raises:
            DAGValidationError: If DAG is linear (no branches/merges).
        """
        if len(nodes) < 3:
            raise DAGValidationError(
                message="DAG must have at least 3 nodes for branching structure",
                details={"nodes_count": len(nodes)},
            )

        # Group nodes by layer
        layers: dict[int, list[dict[str, Any]]] = {}
        for node in nodes:
            layer = node.get("layer", 1)
            if layer not in layers:
                layers[layer] = []
            layers[layer].append(node)

        # Check for branches: at least one layer with 2+ nodes
        has_branch = any(len(layer_nodes) >= 2 for layer_nodes in layers.values())
        if not has_branch:
            raise DAGValidationError(
                message="DAG must have at least one branching layer (2+ parallel nodes)",
                details={"layer_sizes": {k: len(v) for k, v in layers.items()}},
            )

        # Check for merges: at least one node with 2+ prerequisites
        has_merge = any(
            len(node.get("pre_requisites", [])) >= 2
            for node in nodes
        )
        if not has_merge:
            raise DAGValidationError(
                message="DAG must have at least one merge node (node with 2+ prerequisites)",
                details={"max_prerequisites": max(
                    len(node.get("pre_requisites", [])) for node in nodes
                )},
            )
