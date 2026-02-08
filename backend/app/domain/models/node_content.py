"""Node content domain model for storing generated learning materials."""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database import Base


class NodeContent(Base):
    """Stores generated content for DAG nodes (knowledge cards, clarifications, etc.)."""

    __tablename__ = "node_contents"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    course_map_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("course_maps.id", ondelete="CASCADE"),
        nullable=False,
        comment="Which course map this content belongs to",
    )
    node_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="DAG node ID within the course map",
    )
    content_type: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="knowledge_card | clarification | qa_detail",
    )
    question_key: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Hash key to distinguish different questions for same node. "
        "NULL for knowledge_card (one per node), "
        "sha256[:16] of question text for clarification/qa_detail.",
    )
    content_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        comment="Full response content",
    )
    generation_status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="pending",
        server_default="pending",
        comment="Generation status: pending|generating|completed|failed|quiz_pending|quiz_completed",
    )
    generation_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When generation started",
    )
    generation_completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When generation completed",
    )
    generation_error: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Error message if generation failed",
    )
    node_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Node type: learn|quiz",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_node_contents_course_map_id", "course_map_id"),
        Index("idx_node_contents_course_node", "course_map_id", "node_id"),
        Index("idx_node_contents_type", "content_type"),
        Index("idx_node_contents_generation_status", "generation_status"),
        # Note: Partial unique indexes are created in migration files
        # - uq_node_contents_knowledge_card: (course_map_id, node_id, content_type) WHERE question_key IS NULL
        # - uq_node_contents_with_question: (course_map_id, node_id, content_type, question_key) WHERE question_key IS NOT NULL
    )

    def __repr__(self) -> str:
        return f"<NodeContent id={self.id} node={self.node_id} type={self.content_type}>"
