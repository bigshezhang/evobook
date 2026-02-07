"""Quiz generation service.

This module implements quiz generation using LLM based on learned topics.
"""

import json
from typing import Any
from uuid import UUID

from app.core.exceptions import LLMValidationError
from app.core.logging import get_logger
from app.llm.client import LLMClient
from app.llm.validators import OutputFormat
from app.prompts.registry import PromptName, PromptRegistry

logger = get_logger(__name__)


class QuizService:
    """Service for generating quizzes using LLM.

    This service handles quiz generation based on learned topics
    with questions varying in difficulty based on mode.
    """

    def __init__(self, llm_client: LLMClient) -> None:
        """Initialize quiz service.

        Args:
            llm_client: LLM client for generating quizzes.
        """
        self.llm = llm_client

    async def generate_quiz(
        self,
        language: str,
        mode: str,
        learned_topics: list[dict[str, str]],
        user_id: UUID | None = None,
    ) -> dict[str, Any]:
        """Generate a quiz from learned topics.

        Args:
            language: Response language (en|zh).
            mode: Learning mode (Deep|Fast|Light) - affects difficulty.
            learned_topics: List of topics with their page content.
                Each item: {"topic_name": str, "pages_markdown": str}
            user_id: Optional authenticated user ID (reserved for future use).

        Returns:
            Dict containing type, title, greeting, questions.

        Raises:
            LLMValidationError: If LLM response parsing fails.
        """
        logger.info(
            "Generating quiz",
            language=language,
            mode=mode,
            topics_count=len(learned_topics),
        )

        # Build prompt context
        prompt_text = PromptRegistry.get_prompt(PromptName.QUIZ)
        context = json.dumps({
            "language": language,
            "mode": mode,
            "learned_topics": learned_topics,
        }, ensure_ascii=False, indent=2)
        full_prompt = f"{prompt_text}\n\n# User Input\n{context}"

        # Call LLM
        response = await self.llm.complete(
            prompt_name="quiz",
            prompt_text=full_prompt,
            output_format=OutputFormat.JSON,
        )

        # Parse and validate response
        data = response.parsed_data
        if not isinstance(data, dict):
            raise LLMValidationError(
                message="LLM returned invalid quiz structure",
                details={"raw_text": response.raw_text[:500]},
            )

        # Validate quiz structure
        self._validate_quiz_response(data, learned_topics)

        logger.info(
            "Quiz generated",
            title=data.get("title", "")[:50],
            questions_count=len(data.get("questions", [])),
        )

        return {
            "type": "quiz",
            "title": data.get("title", ""),
            "greeting": data.get("greeting", {}),
            "questions": data.get("questions", []),
        }

    def _validate_quiz_response(
        self, data: dict[str, Any], learned_topics: list[dict[str, str]]
    ) -> None:
        """Validate quiz response structure.

        Args:
            data: Parsed response data.
            learned_topics: Original learned topics for validation.

        Raises:
            LLMValidationError: If validation fails.
        """
        # Validate required top-level fields
        required_fields = ["type", "title", "greeting", "questions"]
        missing = [f for f in required_fields if f not in data]
        if missing:
            raise LLMValidationError(
                message=f"Quiz missing required fields: {missing}",
                details={"missing_fields": missing},
            )

        if data.get("type") != "quiz":
            raise LLMValidationError(
                message=f"Invalid quiz type: {data.get('type')}",
                details={"expected": "quiz", "actual": data.get("type")},
            )

        # Validate greeting structure
        greeting = data.get("greeting", {})
        if not isinstance(greeting, dict):
            raise LLMValidationError(
                message="Quiz greeting must be an object",
                details={"greeting": greeting},
            )

        greeting_required = ["topics_included", "message"]
        greeting_missing = [f for f in greeting_required if f not in greeting]
        if greeting_missing:
            raise LLMValidationError(
                message=f"Quiz greeting missing required fields: {greeting_missing}",
                details={"missing_fields": greeting_missing},
            )

        # Validate questions array
        questions = data.get("questions", [])
        if not isinstance(questions, list):
            raise LLMValidationError(
                message="Quiz questions must be an array",
                details={"questions_type": type(questions).__name__},
            )

        if len(questions) < 1:
            raise LLMValidationError(
                message="Quiz must have at least 1 question",
                details={"questions_count": len(questions)},
            )

        # Validate each question
        for i, question in enumerate(questions):
            self._validate_question(question, i)

    def _validate_question(self, question: dict[str, Any], index: int) -> None:
        """Validate a single quiz question.

        Args:
            question: Question data.
            index: Question index for error messages.

        Raises:
            LLMValidationError: If validation fails.
        """
        if not isinstance(question, dict):
            raise LLMValidationError(
                message=f"Question {index} must be an object",
                details={"question_type": type(question).__name__},
            )

        qtype = question.get("qtype")
        if qtype not in ["single", "multi", "boolean"]:
            raise LLMValidationError(
                message=f"Question {index} has invalid qtype: {qtype}",
                details={"valid_types": ["single", "multi", "boolean"]},
            )

        if "prompt" not in question:
            raise LLMValidationError(
                message=f"Question {index} missing prompt",
                details={"question": question},
            )

        # Validate options for single/multi questions
        if qtype in ["single", "multi"]:
            options = question.get("options")
            if not isinstance(options, list) or len(options) < 2:
                raise LLMValidationError(
                    message=f"Question {index} must have at least 2 options",
                    details={"options": options},
                )

        # Validate answer(s)
        if qtype == "single":
            if "answer" not in question:
                raise LLMValidationError(
                    message=f"Single-choice question {index} missing answer",
                    details={"question": question},
                )
        elif qtype == "multi":
            if "answers" not in question and "answer" not in question:
                raise LLMValidationError(
                    message=f"Multi-choice question {index} missing answers",
                    details={"question": question},
                )
        elif qtype == "boolean":
            if "answer" not in question:
                raise LLMValidationError(
                    message=f"Boolean question {index} missing answer",
                    details={"question": question},
                )
