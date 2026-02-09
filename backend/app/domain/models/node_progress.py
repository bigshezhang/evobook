"""Node progress domain model for tracking user learning status."""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database import Base


class NodeProgress(Base):
    """Tracks learning progress per user per node."""

    __tablename__ = "node_progress"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        comment="Which user owns this progress",
    )
    course_map_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("course_maps.id", ondelete="CASCADE"),
        nullable=False,
        comment="Which course map this progress belongs to",
    )
    node_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="DAG node ID within the course map",
    )
    status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="locked",
        comment="locked | unlocked | in_progress | completed",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("user_id", "course_map_id", "node_id", name="uq_user_course_node"),
        Index("idx_node_progress_user_id", "user_id"),
        Index("idx_node_progress_course_map_id", "course_map_id"),
    )

    def __repr__(self) -> str:
        return f"<NodeProgress user={self.user_id} node={self.node_id} status={self.status}>"
