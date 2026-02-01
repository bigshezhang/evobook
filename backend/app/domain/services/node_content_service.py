"""Node content generation services.

This module implements content generation for Knowledge Cards, Clarifications,
and QA Details using LLM.
"""

import json
from typing import Any

from app.core.exceptions import LLMValidationError
from app.core.logging import get_logger
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
    """
    
    def __init__(self, llm_client: LLMClient) -> None:
        """Initialize node content service.
        
        Args:
            llm_client: LLM client for generating content.
        """
        self.llm = llm_client
    
    async def generate_knowledge_card(
        self,
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
    ) -> dict[str, Any]:
        """Generate a knowledge card for a node.
        
        Args:
            course_name: Name of the course.
            course_context: Context description for the course.
            topic: Learning topic.
            level: User level (Novice|Beginner|Intermediate|Advanced).
            mode: Learning mode (Deep|Fast|Light).
            node_id: Node identifier.
            node_title: Title of the node.
            node_description: Description of the node.
            node_type: Node type (learn|boss).
            estimated_minutes: Estimated learning time.
            
        Returns:
            Dict containing type, node_id, totalPagesInCard, markdown, yaml.
            
        Raises:
            LLMValidationError: If LLM response parsing fails.
        """
        logger.info(
            "Generating knowledge card",
            node_id=node_id,
            node_title=node_title,
            mode=mode,
            estimated_minutes=estimated_minutes,
        )
        
        # Build prompt context
        prompt_text = PromptRegistry.get_prompt(PromptName.KNOWLEDGE_CARD)
        context = self._build_knowledge_card_context(
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
        return {
            "type": "knowledge_card",
            "node_id": node_id,
            "totalPagesInCard": data.get("totalPagesInCard", 2),
            "markdown": data.get("markdown", ""),
            "yaml": data.get("yaml", ""),
        }
    
    def _build_knowledge_card_context(
        self,
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
            All parameters from generate_knowledge_card.
            
        Returns:
            Formatted JSON context string.
        """
        return json.dumps({
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
    ) -> dict[str, Any]:
        """Generate a clarification answer for a user question.
        
        Args:
            language: Response language (en|zh).
            user_question_raw: User's raw question text.
            page_markdown: Current page markdown content for context.
            
        Returns:
            Dict containing type, corrected_title, short_answer.
            
        Raises:
            LLMValidationError: If LLM response parsing fails.
        """
        logger.info(
            "Generating clarification",
            language=language,
            question_length=len(user_question_raw),
        )
        
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
        
        return {
            "type": "clarification",
            "corrected_title": data.get("corrected_title", ""),
            "short_answer": data.get("short_answer", ""),
        }
    
    async def generate_qa_detail(
        self,
        language: str,
        qa_title: str,
        qa_short_answer: str,
    ) -> dict[str, Any]:
        """Generate a detailed QA explanation with image spec.
        
        Args:
            language: Response language (en|zh).
            qa_title: Title of the QA.
            qa_short_answer: Short answer to expand upon.
            
        Returns:
            Dict containing type, title, body_markdown, image.
            
        Raises:
            LLMValidationError: If LLM response parsing fails.
        """
        logger.info(
            "Generating QA detail",
            language=language,
            qa_title=qa_title[:50],
        )
        
        # Build prompt context
        prompt_text = PromptRegistry.get_prompt(PromptName.QA_DETAIL)
        context = json.dumps({
            "language": language,
            "qa_title": qa_title,
            "qa_short_answer": qa_short_answer,
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
        
        return {
            "type": "qa_detail",
            "title": data.get("title", ""),
            "body_markdown": data.get("body_markdown", ""),
            "image": {
                "placeholder": image.get("placeholder", ""),
                "prompt": image.get("prompt", ""),
            },
        }
