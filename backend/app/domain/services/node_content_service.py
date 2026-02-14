"""Node content generation services.

This module implements content generation for Knowledge Cards, Clarifications,
and QA Details using LLM, with optional caching via the node_contents table.
"""

import hashlib
import json
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from app.core.exceptions import LLMValidationError
from app.core.logging import get_logger
from app.domain.repositories.node_content_repository import NodeContentRepository
from app.llm.client import LLMClient
from app.llm.validators import OutputFormat
from app.prompts.registry import PromptName, PromptRegistry

logger = get_logger(__name__)


class NodeContentService:
    """Service for generating node content using LLM.

    This service handles:
    1. Knowledge Card generation (paginated markdown content)
    2. Clarification generation (quick answer to user questions)
    3. QA Detail generation (expanded explanation with image spec)

    When a node_content_repo and course_map_id are provided, generated content
    is cached in the node_contents table and returned on subsequent requests.
    """

    def __init__(
        self,
        llm_client: LLMClient,
        node_content_repo: NodeContentRepository | None = None,
    ) -> None:
        """Initialize node content service.

        Args:
            llm_client: LLM client for generating content.
            node_content_repo: Optional repository for caching.
        """
        self.llm = llm_client
        self.node_content_repo = node_content_repo

    async def generate_knowledge_card(
        self,
        language: str,
        course_name: str,
        course_context: str,
        topic: str,
        level: str,
        mode: str,
        node_id: int,
        node_title: str,
        node_description: str,
        node_type: str,
        estimated_minutes: int,
        course_map_id: UUID | None = None,
        user_id: UUID | None = None,
    ) -> dict[str, Any]:
        """Generate a knowledge card for a node.

        If course_map_id is provided and a cached entry exists in node_contents,
        the cached content is returned without calling LLM. After a successful
        LLM generation the result is persisted for future cache hits.

        Args:
            language: Response language ("en" or "zh").
            course_name: Name of the course.
            course_context: Context description for the course.
            topic: Learning topic.
            level: User level (Novice|Beginner|Intermediate|Advanced).
            mode: Learning mode (Deep|Fast|Light).
            node_id: Node identifier.
            node_title: Title of the node.
            node_description: Description of the node.
            node_type: Node type (learn).
            estimated_minutes: Estimated learning time.
            course_map_id: Optional course map ID for caching.
            user_id: Optional authenticated user ID (reserved for future use).

        Returns:
            Dict containing type, node_id, totalPagesInCard, markdown, yaml.

        Raises:
            LLMValidationError: If LLM response parsing fails.
        """
        logger.info(
            "Generating knowledge card",
            language=language,
            node_id=node_id,
            node_title=node_title,
            mode=mode,
            estimated_minutes=estimated_minutes,
            course_map_id=str(course_map_id) if course_map_id else None,
        )

        # Check cache before calling LLM
        cached = await self._get_cached_content(
            course_map_id=course_map_id,
            node_id=node_id,
            content_type="knowledge_card",
        )
        if cached is not None:
            logger.info(
                "Returning cached knowledge card",
                node_id=node_id,
                course_map_id=str(course_map_id),
            )
            return cached

        # Build prompt context
        prompt_text = PromptRegistry.get_prompt(PromptName.KNOWLEDGE_CARD)
        context = self._build_knowledge_card_context(
            language=language,
            course_name=course_name,
            course_context=course_context,
            topic=topic,
            level=level,
            mode=mode,
            node_id=node_id,
            node_title=node_title,
            node_description=node_description,
            node_type=node_type,
            estimated_minutes=estimated_minutes,
        )
        full_prompt = f"{prompt_text}\n\n# User Input\n{context}"

        # Call LLM
        response = await self.llm.complete(
            prompt_name="knowledge_card",
            prompt_text=full_prompt,
            output_format=OutputFormat.JSON,
        )

        # Parse and validate response
        data = response.parsed_data
        if not isinstance(data, dict):
            raise LLMValidationError(
                message="LLM returned invalid knowledge card structure",
                details={"raw_text": response.raw_text[:500]},
            )

        # Validate required fields
        self._validate_knowledge_card_response(data, node_id)

        logger.info(
            "Knowledge card generated",
            node_id=node_id,
            total_pages=data.get("totalPagesInCard"),
        )

        # Always use the request's node_id, not the LLM response
        response_data: dict[str, Any] = {
            "type": "knowledge_card",
            "node_id": node_id,
            "totalPagesInCard": data.get("totalPagesInCard", 2),
            "markdown": data.get("markdown", ""),
            "yaml": data.get("yaml", ""),
        }

        # Cache the result (best-effort)
        await self._save_cached_content(
            course_map_id=course_map_id,
            node_id=node_id,
            content_type="knowledge_card",
            content_json=response_data,
        )

        return response_data

    def _build_knowledge_card_context(
        self,
        language: str,
        course_name: str,
        course_context: str,
        topic: str,
        level: str,
        mode: str,
        node_id: int,
        node_title: str,
        node_description: str,
        node_type: str,
        estimated_minutes: int,
    ) -> str:
        """Build context string for knowledge card prompt.

        Args:
            language: Response language.
            All other parameters from generate_knowledge_card.

        Returns:
            Formatted JSON context string.
        """
        return json.dumps({
            "language": language,
            "course": {
                "course_name": course_name,
                "course_context": course_context,
                "topic": topic,
                "level": level,
                "mode": mode,
            },
            "node": {
                "id": node_id,
                "title": node_title,
                "description": node_description,
                "type": node_type,
                "estimated_minutes": estimated_minutes,
            },
        }, ensure_ascii=False, indent=2)

    def _validate_knowledge_card_response(
        self, data: dict[str, Any], expected_node_id: int
    ) -> None:
        """Validate knowledge card response structure.

        Args:
            data: Parsed response data.
            expected_node_id: Expected node ID.

        Raises:
            LLMValidationError: If validation fails.
        """
        required_fields = ["type", "node_id", "totalPagesInCard", "markdown", "yaml"]
        missing = [f for f in required_fields if f not in data]
        if missing:
            raise LLMValidationError(
                message=f"Knowledge card missing required fields: {missing}",
                details={"missing_fields": missing},
            )

        if data.get("type") != "knowledge_card":
            raise LLMValidationError(
                message=f"Invalid knowledge card type: {data.get('type')}",
                details={"expected": "knowledge_card", "actual": data.get("type")},
            )

        # Validate page break presence in markdown
        markdown = data.get("markdown", "")
        if "<EVOBK_PAGE_BREAK />" not in markdown and data.get("totalPagesInCard", 1) > 1:
            logger.warning(
                "Knowledge card missing page breaks for multi-page content",
                node_id=expected_node_id,
                total_pages=data.get("totalPagesInCard"),
            )

    async def generate_clarification(
        self,
        language: str,
        user_question_raw: str,
        page_markdown: str,
        course_map_id: UUID | None = None,
        node_id: int | None = None,
        user_id: UUID | None = None,
    ) -> dict[str, Any]:
        """Generate a clarification answer for a user question.

        If course_map_id and node_id are provided the result is cached.

        Args:
            language: Response language (en|zh).
            user_question_raw: User's raw question text.
            page_markdown: Current page markdown content for context.
            course_map_id: Optional course map ID for caching.
            node_id: Optional node ID for caching.
            user_id: Optional authenticated user ID (reserved for future use).

        Returns:
            Dict containing type, corrected_title, short_answer.

        Raises:
            LLMValidationError: If LLM response parsing fails.
        """
        # Compute a per-question cache key so different questions on the
        # same node each get their own cached entry.
        question_key = self._compute_question_key(user_question_raw)

        logger.info(
            "Generating clarification",
            language=language,
            question_length=len(user_question_raw),
            question_key=question_key,
            course_map_id=str(course_map_id) if course_map_id else None,
            node_id=node_id,
        )

        # Check cache before calling LLM
        if node_id is not None:
            cached = await self._get_cached_content(
                course_map_id=course_map_id,
                node_id=node_id,
                content_type="clarification",
                question_key=question_key,
            )
            if cached is not None:
                logger.info(
                    "Returning cached clarification",
                    node_id=node_id,
                    question_key=question_key,
                    course_map_id=str(course_map_id),
                )
                return cached

        # Build prompt context
        prompt_text = PromptRegistry.get_prompt(PromptName.CLARIFICATION)
        context = json.dumps({
            "language": language,
            "user_question_raw": user_question_raw,
            "page_markdown": page_markdown,
        }, ensure_ascii=False, indent=2)
        full_prompt = f"{prompt_text}\n\n# User Input\n{context}"

        # Call LLM
        response = await self.llm.complete(
            prompt_name="clarification",
            prompt_text=full_prompt,
            output_format=OutputFormat.JSON,
        )

        # Parse and validate response
        data = response.parsed_data
        if not isinstance(data, dict):
            raise LLMValidationError(
                message="LLM returned invalid clarification structure",
                details={"raw_text": response.raw_text[:500]},
            )

        # Validate required fields
        required_fields = ["type", "corrected_title", "short_answer"]
        missing = [f for f in required_fields if f not in data]
        if missing:
            raise LLMValidationError(
                message=f"Clarification missing required fields: {missing}",
                details={"missing_fields": missing},
            )

        logger.info(
            "Clarification generated",
            corrected_title=data.get("corrected_title", "")[:50],
        )

        response_data: dict[str, Any] = {
            "type": "clarification",
            "corrected_title": data.get("corrected_title", ""),
            "short_answer": data.get("short_answer", ""),
        }

        # Cache the result (best-effort)
        if node_id is not None:
            await self._save_cached_content(
                course_map_id=course_map_id,
                node_id=node_id,
                content_type="clarification",
                content_json=response_data,
                question_key=question_key,
            )

        return response_data

    async def generate_qa_detail(
        self,
        language: str,
        qa_title: str,
        qa_short_answer: str,
        page_markdown: str,
        course_map_id: UUID | None = None,
        node_id: int | None = None,
        user_id: UUID | None = None,
    ) -> dict[str, Any]:
        """Generate a detailed QA explanation with image spec.

        If course_map_id and node_id are provided the result is cached.

        Args:
            language: Response language (en|zh).
            qa_title: Title of the QA.
            qa_short_answer: Short answer to expand upon.
            page_markdown: Current page markdown content to avoid duplication.
            course_map_id: Optional course map ID for caching.
            node_id: Optional node ID for caching.
            user_id: Optional authenticated user ID (reserved for future use).

        Returns:
            Dict containing type, title, body_markdown, image.

        Raises:
            LLMValidationError: If LLM response parsing fails.
        """
        # Compute a per-question cache key so different QA expansions on the
        # same node each get their own cached entry.
        question_key = self._compute_question_key(qa_title)

        logger.info(
            "Generating QA detail",
            language=language,
            qa_title=qa_title[:50],
            question_key=question_key,
            course_map_id=str(course_map_id) if course_map_id else None,
            node_id=node_id,
        )

        # Check cache before calling LLM
        if node_id is not None:
            cached = await self._get_cached_content(
                course_map_id=course_map_id,
                node_id=node_id,
                content_type="qa_detail",
                question_key=question_key,
            )
            if cached is not None:
                logger.info(
                    "Returning cached QA detail",
                    node_id=node_id,
                    question_key=question_key,
                    course_map_id=str(course_map_id),
                )
                return cached

        # Build prompt context
        prompt_text = PromptRegistry.get_prompt(PromptName.QA_DETAIL)
        context = json.dumps({
            "language": language,
            "qa_title": qa_title,
            "qa_short_answer": qa_short_answer,
            "page_markdown": page_markdown,
        }, ensure_ascii=False, indent=2)
        full_prompt = f"{prompt_text}\n\n# User Input\n{context}"

        # Call LLM
        response = await self.llm.complete(
            prompt_name="qa_detail",
            prompt_text=full_prompt,
            output_format=OutputFormat.JSON,
        )

        # Parse and validate response
        data = response.parsed_data
        if not isinstance(data, dict):
            raise LLMValidationError(
                message="LLM returned invalid QA detail structure",
                details={"raw_text": response.raw_text[:500]},
            )

        # Validate required fields
        required_fields = ["type", "title", "body_markdown", "image"]
        missing = [f for f in required_fields if f not in data]
        if missing:
            raise LLMValidationError(
                message=f"QA detail missing required fields: {missing}",
                details={"missing_fields": missing},
            )

        # Validate image structure
        image = data.get("image", {})
        if not isinstance(image, dict) or "placeholder" not in image or "prompt" not in image:
            raise LLMValidationError(
                message="QA detail image must have placeholder and prompt fields",
                details={"image": image},
            )

        logger.info(
            "QA detail generated",
            title=data.get("title", "")[:50],
        )

        response_data: dict[str, Any] = {
            "type": "qa_detail",
            "title": data.get("title", ""),
            "body_markdown": data.get("body_markdown", ""),
            "image": {
                "placeholder": image.get("placeholder", ""),
                "prompt": image.get("prompt", ""),
            },
        }

        # Cache the result (best-effort)
        if node_id is not None:
            await self._save_cached_content(
                course_map_id=course_map_id,
                node_id=node_id,
                content_type="qa_detail",
                content_json=response_data,
                question_key=question_key,
            )

        return response_data

    # ------------------------------------------------------------------
    # Cache helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _compute_question_key(text: str) -> str:
        """Compute a short hash key from a question/title string.

        The text is stripped, lowercased, and SHA-256 hashed.
        Only the first 16 hex characters are returned.

        Args:
            text: Raw question or title text.

        Returns:
            16-character hex digest string.
        """
        return hashlib.sha256(text.strip().lower().encode()).hexdigest()[:16]

    async def _get_cached_content(
        self,
        course_map_id: UUID | None,
        node_id: int,
        content_type: str,
        question_key: str | None = None,
    ) -> dict[str, Any] | None:
        """Look up a cached content row in node_contents.

        Returns the stored content_json dict when a cache hit is found,
        or None on miss or when caching is unavailable.

        Args:
            course_map_id: Course map identifier.
            node_id: Node identifier within the course map.
            content_type: Content type discriminator (e.g. "knowledge_card").
            question_key: Optional hash key to distinguish different questions
                for the same node.  NULL for knowledge cards.

        Returns:
            Cached content dict or None.
        """
        if course_map_id is None or self.node_content_repo is None:
            return None

        try:
            cached = await self.node_content_repo.find_cached_content(
                course_map_id=course_map_id,
                node_id=node_id,
                content_type=content_type,
                question_key=question_key,
            )
            if cached is not None:
                # Validate cached content is not empty
                if cached.content_json and len(cached.content_json) > 0:
                    # Additional check: for knowledge_card, ensure it has actual content
                    if content_type == "knowledge_card":
                        if cached.content_json.get("markdown") or cached.content_json.get("yaml"):
                            logger.info(
                                "Cache hit for node content",
                                course_map_id=str(course_map_id),
                                node_id=node_id,
                                content_type=content_type,
                                question_key=question_key,
                            )
                            return cached.content_json  # type: ignore[return-value]
                        else:
                            logger.warning(
                                "Cache hit but content is invalid (empty markdown/yaml), will regenerate",
                                course_map_id=str(course_map_id),
                                node_id=node_id,
                            )
                    else:
                        logger.info(
                            "Cache hit for node content",
                            course_map_id=str(course_map_id),
                            node_id=node_id,
                            content_type=content_type,
                            question_key=question_key,
                        )
                        return cached.content_json  # type: ignore[return-value]
        except Exception:
            # Cache lookup is best-effort; log and continue to LLM
            logger.warning(
                "Failed to read cached content, falling back to LLM",
                course_map_id=str(course_map_id),
                node_id=node_id,
                content_type=content_type,
                question_key=question_key,
                exc_info=True,
            )
        return None

    async def _save_cached_content(
        self,
        course_map_id: UUID | None,
        node_id: int,
        content_type: str,
        content_json: dict[str, Any],
        question_key: str | None = None,
    ) -> None:
        """Persist generated content to node_contents for future cache hits.

        This is best-effort: if the save fails the caller still returns
        the freshly generated response.

        Args:
            course_map_id: Course map identifier.
            node_id: Node identifier within the course map.
            content_type: Content type discriminator (e.g. "knowledge_card").
            content_json: Full response dict to cache.
            question_key: Optional hash key to distinguish different questions
                for the same node.  NULL for knowledge cards.
        """
        if course_map_id is None or self.node_content_repo is None:
            return

        try:
            await self.node_content_repo.upsert_content(
                course_map_id=course_map_id,
                node_id=node_id,
                content_type=content_type,
                content_json=content_json,
                question_key=question_key,
                generation_status="completed",
                completed_at=datetime.now(timezone.utc),
            )
            await self.node_content_repo.commit()
            logger.info(
                "Cached node content",
                course_map_id=str(course_map_id),
                node_id=node_id,
                content_type=content_type,
                question_key=question_key,
            )
        except Exception:
            # Best-effort caching — rollback and continue
            await self.node_content_repo.rollback()
            logger.warning(
                "Failed to cache node content",
                course_map_id=str(course_map_id),
                node_id=node_id,
                content_type=content_type,
                question_key=question_key,
                exc_info=True,
            )
