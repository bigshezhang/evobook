"""Script to check for quiz attempts with missing answers in questions.

This script queries the database to find quiz attempts where one or more
questions are missing the required 'answer' or 'answers' field.
"""

import asyncio
import json
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.domain.models.quiz_attempt import QuizAttempt
from app.infrastructure.database import get_async_session_maker


async def check_missing_answers() -> None:
    """Check database for quiz attempts with missing answers."""
    settings = get_settings()
    session_maker = get_async_session_maker(settings.database_url)

    async with session_maker() as session:
        # Query all quiz attempts
        result = await session.execute(select(QuizAttempt))
        attempts = result.scalars().all()

        print(f"Total quiz attempts in database: {len(attempts)}")
        print("=" * 80)

        missing_answer_attempts = []

        for attempt in attempts:
            quiz_json = attempt.quiz_json
            questions = quiz_json.get("questions", [])

            # Check each question for missing answers
            missing_questions = []
            for idx, question in enumerate(questions):
                qtype = question.get("qtype")
                has_answer = False

                if qtype == "single":
                    has_answer = "answer" in question and question["answer"] is not None
                elif qtype == "multi":
                    has_answer = (
                        ("answers" in question and question["answers"] is not None)
                        or ("answer" in question and question["answer"] is not None)
                    )
                elif qtype == "boolean":
                    has_answer = "answer" in question and question["answer"] is not None
                else:
                    # Unknown question type
                    has_answer = False

                if not has_answer:
                    missing_questions.append({
                        "index": idx,
                        "qtype": qtype,
                        "prompt": question.get("prompt", "")[:100],
                    })

            if missing_questions:
                missing_answer_attempts.append({
                    "attempt_id": str(attempt.id),
                    "user_id": str(attempt.user_id),
                    "course_map_id": str(attempt.course_map_id),
                    "node_id": attempt.node_id,
                    "score": attempt.score,
                    "created_at": attempt.created_at.isoformat(),
                    "total_questions": len(questions),
                    "missing_questions": missing_questions,
                })

        # Print results
        if missing_answer_attempts:
            print(f"\n🚨 Found {len(missing_answer_attempts)} quiz attempts with missing answers:\n")
            for item in missing_answer_attempts:
                print(f"Attempt ID: {item['attempt_id']}")
                print(f"  User ID: {item['user_id']}")
                print(f"  Course Map ID: {item['course_map_id']}")
                print(f"  Node ID: {item['node_id']}")
                print(f"  Score: {item['score']}")
                print(f"  Created: {item['created_at']}")
                print(f"  Total Questions: {item['total_questions']}")
                print(f"  Missing Answers in Questions:")
                for q in item["missing_questions"]:
                    print(f"    - Question {q['index'] + 1} (type: {q['qtype']}): {q['prompt']}")
                print("-" * 80)

            # Save to file
            output_file = Path(__file__).parent.parent / ".out" / "quiz_missing_answers.json"
            output_file.parent.mkdir(exist_ok=True)
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(missing_answer_attempts, f, ensure_ascii=False, indent=2)
            print(f"\n📝 Detailed results saved to: {output_file}")
        else:
            print("✅ No quiz attempts with missing answers found!")


if __name__ == "__main__":
    asyncio.run(check_missing_answers())
