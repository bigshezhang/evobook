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

        Returns the quiz immediately even if some answers are missing.
        Missing answers can be filled in later using fill_missing_answers().

        Args:
            language: Response language (en|zh).
            mode: Learning mode (Deep|Fast|Light) - affects difficulty.
            learned_topics: List of topics with their page content.
                Each item: {"topic_name": str, "pages_markdown": str}
            user_id: Optional authenticated user ID (reserved for future use).

        Returns:
            Dict containing type, title, greeting, questions.
            Note: Some questions may have missing answers.

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

        # Validate quiz structure (but don't fail on missing answers)
        self._validate_quiz_response(data, learned_topics, check_answers=False)

        # Log if there are missing answers (for monitoring)
        missing_answers_issues = self._check_missing_answers(data.get("questions", []))
        if missing_answers_issues:
            logger.warning(
                "Quiz generated with missing answers",
                title=data.get("title", "")[:50],
                questions_count=len(data.get("questions", [])),
                missing_count=len(missing_answers_issues),
            )
        else:
            logger.info(
                "Quiz generated successfully with all answers",
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
        self, data: dict[str, Any], learned_topics: list[dict[str, str]], check_answers: bool = True
    ) -> None:
        """Validate quiz response structure.

        Args:
            data: Parsed response data.
            learned_topics: Original learned topics for validation.
            check_answers: Whether to validate that answers are present.

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
            self._validate_question(question, i, check_answers=check_answers)

    def _validate_question(self, question: dict[str, Any], index: int, check_answers: bool = True) -> None:
        """Validate a single quiz question.

        Args:
            question: Question data.
            index: Question index for error messages.
            check_answers: Whether to validate that answers are present.

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

        # Validate answer(s) only if check_answers is True
        if check_answers:
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

    async def fill_missing_answers(
        self,
        questions: list[dict[str, Any]],
        language: str,
    ) -> list[dict[str, Any]]:
        """Fill in missing answers for quiz questions.

        This method calls LLM to generate ONLY the missing answers,
        without regenerating the questions themselves.

        Args:
            questions: List of quiz questions (some may have missing answers).
            language: Response language (en|zh).

        Returns:
            Updated list of questions with answers filled in.

        Raises:
            LLMValidationError: If LLM fails to generate valid answers.
        """
        # Find questions with missing answers
        missing_issues = self._check_missing_answers(questions)
        
        if not missing_issues:
            logger.info("No missing answers to fill")
            return questions

        logger.info(
            "Filling missing answers",
            missing_count=len(missing_issues),
            total_questions=len(questions),
        )

        # Build a prompt that asks LLM to provide ONLY the answers
        questions_needing_answers = []
        for issue in missing_issues:
            idx = issue["question_index"]
            q = questions[idx]
            questions_needing_answers.append({
                "index": idx,
                "qtype": q.get("qtype"),
                "prompt": q.get("prompt"),
                "options": q.get("options"),
            })

        prompt_text = f"""# Role
You are a quiz answer generator. Your job is to provide ONLY the correct answers for the given questions.

# Language
{language}

# Instructions
For each question below, provide the correct answer(s) based on the question type:
- For "single" type: provide one correct answer (string)
- For "multi" type: provide an array of correct answers (array of strings)
- For "boolean" type: provide "True" or "False" (string)

# Questions Needing Answers
{json.dumps(questions_needing_answers, ensure_ascii=False, indent=2)}

# Output Format (STRICT JSON)
Return a JSON object with answers for each question:
{{
  "answers": [
    {{
      "index": 0,
      "answer": "correct answer" // for single/boolean
    }},
    {{
      "index": 1,
      "answers": ["answer1", "answer2"] // for multi
    }}
  ]
}}

IMPORTANT: Only provide the answers, do NOT regenerate the questions.
"""

        # Call LLM to get answers
        response = await self.llm.complete(
            prompt_name="quiz_fill_answers",
            prompt_text=prompt_text,
            output_format=OutputFormat.JSON,
        )

        # Parse response
        data = response.parsed_data
        if not isinstance(data, dict) or "answers" not in data:
            raise LLMValidationError(
                message="LLM returned invalid answer structure",
                details={"raw_text": response.raw_text[:500]},
            )

        # Apply answers to questions
        updated_questions = questions.copy()
        answers_filled = 0
        
        for answer_item in data["answers"]:
            idx = answer_item.get("index")
            if idx is None or idx < 0 or idx >= len(updated_questions):
                logger.warning(f"Invalid question index in answer: {idx}")
                continue

            question = updated_questions[idx]
            qtype = question.get("qtype")

            # Apply the answer based on question type
            if qtype == "single" and "answer" in answer_item:
                question["answer"] = answer_item["answer"]
                answers_filled += 1
            elif qtype == "multi" and "answers" in answer_item:
                question["answers"] = answer_item["answers"]
                answers_filled += 1
            elif qtype == "boolean" and "answer" in answer_item:
                question["answer"] = answer_item["answer"]
                answers_filled += 1

        logger.info(
            "Filled missing answers",
            answers_filled=answers_filled,
            total_missing=len(missing_issues),
        )

        # Verify all answers are now present
        remaining_issues = self._check_missing_answers(updated_questions)
        if remaining_issues:
            logger.warning(
                "Still have missing answers after fill",
                remaining_count=len(remaining_issues),
            )

        return updated_questions

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
