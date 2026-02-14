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
        max_retries: int = 2,
    ) -> dict[str, Any]:
        """Generate a quiz from learned topics.

        Args:
            language: Response language (en|zh).
            mode: Learning mode (Deep|Fast|Light) - affects difficulty.
            learned_topics: List of topics with their page content.
                Each item: {"topic_name": str, "pages_markdown": str}
            user_id: Optional authenticated user ID (reserved for future use).
            max_retries: Maximum number of retries if answers are missing.

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

        last_error: LLMValidationError | None = None

        for attempt in range(max_retries + 1):
            try:
                # Build prompt context
                prompt_text = PromptRegistry.get_prompt(PromptName.QUIZ)
                context = json.dumps({
                    "language": language,
                    "mode": mode,
                    "learned_topics": learned_topics,
                }, ensure_ascii=False, indent=2)
                full_prompt = f"{prompt_text}\n\n# User Input\n{context}"

                # If this is a retry, add error feedback to prompt
                if attempt > 0 and last_error:
                    error_message = self._format_error_message_for_retry(last_error)
                    full_prompt = (
                        f"{full_prompt}\n\n"
                        f"# IMPORTANT - Previous Generation Error\n"
                        f"The previous quiz generation had the following issue:\n"
                        f"{error_message}\n\n"
                        f"Please regenerate the quiz and make sure ALL questions have the required answer fields:\n"
                        f"- 'single' type questions MUST have an 'answer' field (string)\n"
                        f"- 'multi' type questions MUST have an 'answers' field (array of strings)\n"
                        f"- 'boolean' type questions MUST have an 'answer' field (string: 'True' or 'False')\n"
                    )

                    logger.warning(
                        "Retrying quiz generation with error feedback",
                        attempt=attempt + 1,
                        error=str(last_error),
                    )

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

                # Success! Check specifically for missing answers
                missing_answers_issues = self._check_missing_answers(data.get("questions", []))
                if missing_answers_issues:
                    raise LLMValidationError(
                        message="Quiz questions missing required answer fields",
                        details={"missing_answers": missing_answers_issues},
                    )

                logger.info(
                    "Quiz generated successfully",
                    title=data.get("title", "")[:50],
                    questions_count=len(data.get("questions", [])),
                    attempts=attempt + 1,
                )

                return {
                    "type": "quiz",
                    "title": data.get("title", ""),
                    "greeting": data.get("greeting", {}),
                    "questions": data.get("questions", []),
                }

            except LLMValidationError as e:
                last_error = e
                if attempt < max_retries:
                    # Continue to next retry
                    continue
                else:
                    # No more retries, raise the error
                    logger.error(
                        "Quiz generation failed after all retries",
                        max_retries=max_retries,
                        error=str(e),
                    )
                    raise

        # Should not reach here, but just in case
        raise last_error or LLMValidationError(
            message="Quiz generation failed for unknown reason",
            details={},
        )

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

    def _check_missing_answers(self, questions: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Check if any questions are missing required answer fields.

        Args:
            questions: List of quiz questions to check.

        Returns:
            List of issues found (empty if all questions have answers).
        """
        issues = []

        for idx, question in enumerate(questions):
            qtype = question.get("qtype")
            prompt = question.get("prompt", "")[:100]
            issue = None

            if qtype == "single":
                if "answer" not in question or question.get("answer") is None:
                    issue = {
                        "question_index": idx,
                        "qtype": qtype,
                        "prompt": prompt,
                        "issue": "Missing 'answer' field (required for single-choice questions)",
                    }
            elif qtype == "multi":
                has_answers = "answers" in question and question.get("answers") is not None
                has_answer = "answer" in question and question.get("answer") is not None
                if not has_answers and not has_answer:
                    issue = {
                        "question_index": idx,
                        "qtype": qtype,
                        "prompt": prompt,
                        "issue": "Missing 'answers' field (required for multi-choice questions)",
                    }
            elif qtype == "boolean":
                if "answer" not in question or question.get("answer") is None:
                    issue = {
                        "question_index": idx,
                        "qtype": qtype,
                        "prompt": prompt,
                        "issue": "Missing 'answer' field (required for boolean questions)",
                    }

            if issue:
                issues.append(issue)

        return issues

    def _format_error_message_for_retry(self, error: LLMValidationError) -> str:
        """Format error message for LLM retry with specific guidance.

        Args:
            error: The validation error that occurred.

        Returns:
            Formatted error message string.
        """
        message = error.message
        details = error.details or {}

        # Format missing answers issues
        if "missing_answers" in details:
            issues = details["missing_answers"]
            error_lines = [f"Found {len(issues)} question(s) with missing answers:"]
            for issue in issues:
                error_lines.append(
                    f"  - Question {issue['question_index'] + 1} "
                    f"(type: {issue['qtype']}): {issue['issue']}"
                )
                error_lines.append(f"    Prompt: {issue['prompt']}")
            return "\n".join(error_lines)

        # Generic error formatting
        if details:
            details_str = json.dumps(details, ensure_ascii=False, indent=2)
            return f"{message}\nDetails: {details_str}"

        return message
