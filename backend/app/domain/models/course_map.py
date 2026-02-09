"""Course map domain model for storing generated DAG structures."""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database import Base


class CourseMap(Base):
    """Stores generated course maps (DAG) for learning paths.

    Each course map contains a DAG structure with nodes that represent
    learning units and quizzes.
    """

    __tablename__ = "course_maps"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="SET NULL"),
        nullable=True,
        comment="Owner user, nullable for backward compatibility",
    )
    topic: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Learning topic from onboarding",
    )
    level: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Novice | Beginner | Intermediate | Advanced",
    )
    focus: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="User's learning focus/goal",
    )
    verified_concept: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Concept verified during onboarding",
    )
    mode: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Deep | Fast | Light",
    )
    language: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        server_default="en",
        comment="User's preferred language (ISO 639-1, e.g. en, zh)",
    )
    total_commitment_minutes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Total time budget in minutes",
    )
    map_meta: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        comment="Course metadata: course_name, strategy_rationale, etc.",
    )
    nodes: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=False,
        comment="DAG nodes array with id, title, type, layer, pre_requisites, estimated_minutes, reward_multiplier",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_course_maps_topic", "topic"),
        Index("idx_course_maps_mode", "mode"),
        Index("idx_course_maps_created_at", "created_at"),
        Index("idx_course_maps_user_id", "user_id"),
    )

    def __repr__(self) -> str:
        return f"<CourseMap id={self.id} topic={self.topic} mode={self.mode}>"
