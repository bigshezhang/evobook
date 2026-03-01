"""Prompt test execution service.

This service handles batch testing of prompts against existing course maps.
For each (prompt_name, course_map_id) pair, it constructs realistic input
variables from the course data and calls the LLM, then persists the results.
"""

import json
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.domain.models.course_map import CourseMap
from app.domain.models.node_content import NodeContent
from app.domain.models.prompt_test import PromptTestResult, PromptTestRun
from app.infrastructure.database import get_session_factory
from app.llm.client import LLMClient
from app.llm.validators import OutputFormat

logger = get_logger(__name__)

# Output format per prompt name
_PROMPT_OUTPUT_FORMATS: dict[str, OutputFormat] = {
    "onboarding": OutputFormat.JSON,
    "dag": OutputFormat.JSON,
    "knowledge_card": OutputFormat.JSON,
    "clarification": OutputFormat.JSON,
    "qa_detail": OutputFormat.JSON,
    "quiz": OutputFormat.JSON,
    "image_prompt": OutputFormat.JSON,
}


class PromptTestService:
    """Service for executing batch prompt tests against course map data."""

    def __init__(self, llm_client: LLMClient) -> None:
        """Initialize prompt test service.

        Args:
            llm_client: LLM client for completions.
        """
        self.llm = llm_client

    async def run_test(self, run_id: UUID) -> None:
        """Execute all results for a test run in a background task.

        Loads the PromptTestRun, iterates over all course_map_ids,
        and generates one PromptTestResult per course map.
        Updates run status to completed or failed when done.

        Args:
            run_id: UUID of the PromptTestRun to execute.
        """
        session_factory = get_session_factory()

        async with session_factory() as db:
            run = await db.get(PromptTestRun, run_id)
            if run is None:
                logger.error("PromptTestRun not found", run_id=str(run_id))
                return

            logger.info(
                "Starting prompt test run",
                run_id=str(run_id),
                prompt_name=run.prompt_name,
                course_count=len(run.course_map_ids),
            )

            any_failure = False

            for cm_id_str in run.course_map_ids:
                cm_id = UUID(str(cm_id_str))
                result = await self._get_result_by_course(db, run_id, cm_id)
                if result is None:
                    logger.warning(
                        "PromptTestResult not found for course map, skipping",
                        run_id=str(run_id),
                        course_map_id=str(cm_id),
                    )
                    continue

                try:
                    await self._execute_single_result(db, run, result, cm_id)
                except Exception as e:
                    any_failure = True
                    logger.error(
                        "Error executing prompt test result",
                        run_id=str(run_id),
                        result_id=str(result.id),
                        error=str(e),
                        exc_info=True,
                    )

            # Update run status
            run.status = "failed" if any_failure else "completed"
            await db.commit()

            logger.info(
                "Prompt test run finished",
                run_id=str(run_id),
                status=run.status,
            )

    async def _get_result_by_course(
        self,
        db: AsyncSession,
        run_id: UUID,
        course_map_id: UUID,
    ) -> PromptTestResult | None:
        """Retrieve the PromptTestResult for a specific course map."""
        stmt = select(PromptTestResult).where(
            PromptTestResult.run_id == run_id,
            PromptTestResult.course_map_id == course_map_id,
        )
        row = await db.execute(stmt)
        return row.scalar_one_or_none()

    async def _execute_single_result(
        self,
        db: AsyncSession,
        run: PromptTestRun,
        result: PromptTestResult,
        course_map_id: UUID,
    ) -> None:
        """Execute LLM call for one course map and update the result record.

        Args:
            db: Database session.
            run: Parent test run (contains prompt_name and prompt_text).
            result: Result record to update.
            course_map_id: Course map to load data from.
        """
        # Mark as generating
        result.status = "generating"
        await db.commit()

        # Load course map
        course_map = await db.get(CourseMap, course_map_id)
        if course_map is None:
            result.status = "failed"
            result.error_message = f"Course map {course_map_id} not found"
            await db.commit()
            return

        # Load existing knowledge card content if available (used by clarification/qa_detail)
        knowledge_card_markdown = await self._get_knowledge_card_markdown(db, course_map_id)

        # Build input variables for this prompt
        variables = self._build_variables(
            prompt_name=run.prompt_name,
            course_map=course_map,
            knowledge_card_markdown=knowledge_card_markdown,
        )

        # Construct full prompt (template + user input context)
        full_prompt = self._build_full_prompt(
            prompt_name=run.prompt_name,
            prompt_text=run.prompt_text,
            variables=variables,
        )

        output_format = _PROMPT_OUTPUT_FORMATS.get(run.prompt_name, OutputFormat.TEXT)

        try:
            response = await self.llm.complete(
                prompt_name=run.prompt_name,
                prompt_text=full_prompt,
                output_format=output_format,
            )

            result.input_variables = variables
            result.output_raw = response.raw_text
            result.output_parsed = response.parsed_data if isinstance(response.parsed_data, dict) else None
            result.latency_ms = response.latency_ms
            result.status = "completed" if response.success else "failed"
            if not response.success:
                result.error_message = "LLM call failed or validation error"

        except Exception as e:
            result.status = "failed"
            result.error_message = str(e)[:2000]
            result.input_variables = variables

        await db.commit()

    def _build_variables(
        self,
        prompt_name: str,
        course_map: CourseMap,
        knowledge_card_markdown: str | None,
    ) -> dict[str, Any]:
        """Build input variables from course map data for a given prompt.

        Each prompt has a different set of required variables. This method
        derives them from the available course_map fields.

        Args:
            prompt_name: The prompt key (e.g. "dag", "clarification").
            course_map: Loaded CourseMap model.
            knowledge_card_markdown: Existing knowledge card markdown, if any.

        Returns:
            Dict of variable name → value, recorded as the input snapshot.
        """
        nodes: list[dict[str, Any]] = course_map.nodes or []
        learn_nodes = [n for n in nodes if n.get("type") == "learn"]
        first_node = learn_nodes[0] if learn_nodes else (nodes[0] if nodes else {})
        map_meta: dict[str, Any] = course_map.map_meta or {}
        course_name = map_meta.get("course_name", course_map.topic)

        # Topics list for quiz
        topic_titles = [n.get("title", "") for n in learn_nodes[:8]]

        # Mock clarification question based on topic
        mock_question = f"What is {first_node.get('title', course_map.topic)}?"

        # Page markdown fallback if no knowledge card available
        page_markdown = knowledge_card_markdown or (
            f"## {first_node.get('title', course_map.topic)}\n\n"
            f"{first_node.get('description', 'This is a learning node about ' + course_map.topic)}"
        )

        if prompt_name == "dag":
            return {
                "topic": course_map.topic,
                "level": course_map.level,
                "focus": course_map.focus,
                "mode": course_map.mode,
                "total_minutes": course_map.total_commitment_minutes,
                "interested_concepts": course_map.verified_concept,
            }

        elif prompt_name == "knowledge_card":
            return {
                "language": course_map.language,
                "course_name": course_name,
                "course_context": f"A {course_map.mode} mode course about {course_map.topic} at {course_map.level} level. Focus: {course_map.focus}",
                "topic": course_map.topic,
                "level": course_map.level,
                "mode": course_map.mode,
                "node_id": first_node.get("id", 1),
                "node_title": first_node.get("title", course_map.topic),
                "node_description": first_node.get("description", ""),
                "node_type": first_node.get("type", "learn"),
                "estimated_minutes": first_node.get("estimated_minutes", 20),
            }

        elif prompt_name == "clarification":
            return {
                "language": course_map.language,
                "user_question_raw": mock_question,
                "page_markdown": page_markdown,
            }

        elif prompt_name == "qa_detail":
            short_answer = f"{first_node.get('title', course_map.topic)} is a key concept in {course_map.topic}."
            return {
                "language": course_map.language,
                "qa_title": mock_question,
                "qa_short_answer": short_answer,
                "page_markdown": page_markdown,
            }

        elif prompt_name == "quiz":
            learned_topics_json = json.dumps(
                [{"topic_name": t, "pages_markdown": f"## {t}\n\nContent about {t}."} for t in topic_titles],
                ensure_ascii=False,
            )
            return {
                "language": course_map.language,
                "mode": course_map.mode,
                "level": course_map.level,
                "learned_topics": learned_topics_json,
            }

        elif prompt_name == "image_prompt":
            return {
                "language": course_map.language,
                "page_markdown": page_markdown,
            }

        elif prompt_name == "onboarding":
            return {
                "topic": course_map.topic,
                "level": course_map.level,
                "focus": course_map.focus,
            }

        # Fallback: pass basic info
        return {
            "topic": course_map.topic,
            "level": course_map.level,
            "mode": course_map.mode,
        }

    def _build_full_prompt(
        self,
        prompt_name: str,
        prompt_text: str,
        variables: dict[str, Any],
    ) -> str:
        """Combine prompt template with user input context.

        Mirrors the pattern used by existing node content services:
        the prompt template is followed by a formatted user input block.

        Args:
            prompt_name: Prompt key.
            prompt_text: Prompt template (potentially user-modified).
            variables: Input variables for this test case.

        Returns:
            Full prompt string ready to send to LLM.
        """
        # Format each variable as readable key: value lines
        lines = []
        for key, value in variables.items():
            if isinstance(value, str) and "\n" in value:
                lines.append(f"{key}:\n{value}")
            else:
                lines.append(f"{key}: {value}")
        context = "\n".join(lines)
        return f"{prompt_text}\n\n# User Input\n{context}"

    async def _get_knowledge_card_markdown(
        self,
        db: AsyncSession,
        course_map_id: UUID,
    ) -> str | None:
        """Load the first available knowledge card markdown for a course map.

        Args:
            db: Database session.
            course_map_id: Course map UUID.

        Returns:
            Markdown string from the first completed knowledge card, or None.
        """
        stmt = (
            select(NodeContent)
            .where(
                NodeContent.course_map_id == course_map_id,
                NodeContent.content_type == "knowledge_card",
                NodeContent.generation_status == "completed",
            )
            .limit(1)
        )
        row = await db.execute(stmt)
        content = row.scalar_one_or_none()
        if content and isinstance(content.content_json, dict):
            return content.content_json.get("markdown")
        return None


async def create_and_run_test(
    run_id: UUID,
    llm_client: LLMClient,
) -> None:
    """Entry point for BackgroundTasks: create service and run the test.

    Args:
        run_id: UUID of the PromptTestRun to execute.
        llm_client: LLM client instance.
    """
    service = PromptTestService(llm_client=llm_client)
    await service.run_test(run_id=run_id)
