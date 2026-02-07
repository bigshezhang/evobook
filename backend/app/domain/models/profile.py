"""User profile domain model linked to Supabase auth.users."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Text, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database import Base


class Profile(Base):
    """User business profile, 1:1 with Supabase auth.users.
    
    The id comes from Supabase auth.users.id (set on registration).
    """

    __tablename__ = "profiles"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        comment="Matches Supabase auth.users.id",
    )
    display_name: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="User display name",
    )
    mascot: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Selected mascot/companion identifier",
    )
    onboarding_completed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
        comment="Whether user has completed onboarding",
    )
    
    # 活跃课程相关字段
    active_course_map_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("course_maps.id", ondelete="SET NULL"),
        nullable=True,
        comment="User-set active course for home page",
    )
    last_accessed_course_map_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("course_maps.id", ondelete="SET NULL"),
        nullable=True,
        comment="Last accessed course map",
    )
    last_accessed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp of last course access",
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

    def __repr__(self) -> str:
        return f"<Profile id={self.id} name={self.display_name}>"
