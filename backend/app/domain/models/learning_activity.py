"""Learning activity domain model for tracking user learning history."""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database import Base


class LearningActivity(Base):
    """Tracks individual learning activities for activity heatmap.

    Each record represents a completed activity (node, quiz, knowledge card)
    with UTC timestamp. Frontend will handle timezone conversion for display.
    """

    __tablename__ = "learning_activities"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        comment="User who completed this activity",
    )
    course_map_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("course_maps.id", ondelete="CASCADE"),
        nullable=False,
        comment="Course map this activity belongs to",
    )
    node_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="DAG node ID within the course map",
    )
    activity_type: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Activity type: node_completed | quiz_passed | knowledge_card_finished",
    )
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        default=lambda: datetime.now(timezone.utc),
        comment="UTC timestamp when activity was completed",
    )
    extra_data: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Optional extra data (e.g., score, time_spent_seconds)",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        default=lambda: datetime.now(timezone.utc),
        comment="Record creation timestamp",
    )

    __table_args__ = (
        Index("idx_learning_activities_user_time", "user_id", text("completed_at DESC")),
        Index("idx_learning_activities_user_course", "user_id", "course_map_id"),
        Index("idx_learning_activities_type", "activity_type"),
    )

    def __repr__(self) -> str:
        return f"<LearningActivity user={self.user_id} type={self.activity_type} node={self.node_id}>"
