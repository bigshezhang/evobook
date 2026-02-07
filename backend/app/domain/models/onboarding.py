"""Onboarding session domain model."""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database import Base


class OnboardingSession(Base):
    """Stores onboarding dialogue state and final profile."""
    
    __tablename__ = "onboarding_sessions"
    
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
    phase: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="exploration",
        comment="exploration | calibration_r1 | calibration_r2 | focus | source | handoff",
    )
    topic: Mapped[str | None] = mapped_column(Text, nullable=True)
    level: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Novice | Beginner | Intermediate | Advanced",
    )
    verified_concept: Mapped[str | None] = mapped_column(Text, nullable=True)
    focus: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(Text, nullable=True)
    intent: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="add_info | change_topic",
    )
    state_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        comment="Full internal state snapshot",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    
    __table_args__ = (
        Index("idx_onboarding_phase", "phase"),
        Index("idx_onboarding_topic", "topic"),
        Index("idx_onboarding_user_id", "user_id"),
    )
    
    def __repr__(self) -> str:
        return f"<OnboardingSession id={self.id} phase={self.phase} topic={self.topic}>"
