"""Quiz attempt domain model for storing quiz results."""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, Integer, text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database import Base


class QuizAttempt(Base):
    """Stores quiz attempts and results per user."""

    __tablename__ = "quiz_attempts"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        comment="Which user took this quiz",
    )
    course_map_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("course_maps.id", ondelete="CASCADE"),
        nullable=False,
        comment="Which course map this quiz belongs to",
    )
    quiz_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        comment="Full quiz content: questions, options, correct answers, user answers",
    )
    score: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Quiz score (percentage or points)",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_quiz_attempts_user_id", "user_id"),
        Index("idx_quiz_attempts_course_map_id", "course_map_id"),
        Index("idx_quiz_attempts_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<QuizAttempt id={self.id} user={self.user_id} score={self.score}>"
