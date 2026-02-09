"""Discovery course domain model.

Stores curated courses that users can discover and start learning.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Index, Integer, Numeric, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database import Base


class DiscoveryCourse(Base):
    """Curated discovery course available in the discovery feed.

    These courses serve as starting points for onboarding. When a user
    selects a discovery course, the seed_context is used to pre-fill
    the onboarding conversation.
    """

    __tablename__ = "discovery_courses"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
        comment="Primary key",
    )
    preset_id: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        unique=True,
        comment="Unique preset identifier (e.g. 'quantum-physics-intro')",
    )
    title: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Course display title",
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Course description",
    )
    image_url: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Course cover image URL",
    )
    category: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Category: 'recommended', 'popular', 'friends'",
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
        comment="Display order within category (lower first)",
    )
    rating: Mapped[Decimal] = mapped_column(
        Numeric(3, 1),
        nullable=False,
        default=Decimal("4.5"),
        comment="Course rating (0.0-5.0)",
    )
    seed_context: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        comment="Onboarding seed context: topic, suggested_level, key_concepts, focus",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
        comment="Whether this course is visible in discovery",
    )
    view_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
        comment="Number of times viewed",
    )
    start_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
        comment="Number of times user clicked start/add",
    )
    completion_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
        comment="Number of users who completed this course",
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
        Index("idx_discovery_courses_category", "category"),
        Index("idx_discovery_courses_active", "is_active"),
        Index("idx_discovery_courses_order", "category", "display_order"),
    )

    def __repr__(self) -> str:
        return f"<DiscoveryCourse id={self.id} preset_id={self.preset_id} title={self.title}>"
