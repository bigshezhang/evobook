"""Prompt test domain models for LLM testing system."""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database import Base


class PromptTestRun(Base):
    """Stores a batch test run for a specific prompt.

    A test run selects one prompt (by name), optionally a modified version,
    and tests it against multiple course maps. After generation is complete,
    the user can score the run and add a review comment.
    """

    __tablename__ = "prompt_test_runs"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    prompt_name: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Prompt name key (matches PromptName enum)",
    )
    prompt_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Snapshot of the exact prompt text used (may differ from current file)",
    )
    prompt_hash: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="SHA256 of prompt_text",
    )
    course_map_ids: Mapped[list[Any]] = mapped_column(
        JSONB,
        nullable=False,
        comment="Array of course_map UUIDs selected for this test run",
    )
    status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="running",
        server_default="running",
        comment="running | completed | failed",
    )
    score: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="1-5 rating assigned by user after review",
    )
    review_comment: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Free-text review comment from user",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_prompt_test_runs_prompt_name", "prompt_name"),
        Index("idx_prompt_test_runs_status", "status"),
        Index("idx_prompt_test_runs_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<PromptTestRun id={self.id} prompt={self.prompt_name} status={self.status}>"


class PromptTestResult(Base):
    """Stores a single LLM result within a batch test run.

    Each result corresponds to one course map tested against the prompt.
    """

    __tablename__ = "prompt_test_results"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    run_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("prompt_test_runs.id", ondelete="CASCADE"),
        nullable=False,
        comment="Parent batch test run",
    )
    course_map_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("course_maps.id", ondelete="CASCADE"),
        nullable=False,
        comment="Course map used as test input",
    )
    input_variables: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        comment="Variables snapshot passed to the prompt template",
    )
    output_raw: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Raw LLM text output",
    )
    output_parsed: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Parsed output (dict) if prompt outputs JSON",
    )
    status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="pending",
        server_default="pending",
        comment="pending | generating | completed | failed",
    )
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Error message when status=failed",
    )
    latency_ms: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="LLM call latency in milliseconds",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_prompt_test_results_run_id", "run_id"),
        Index("idx_prompt_test_results_course_map_id", "course_map_id"),
        Index("idx_prompt_test_results_status", "status"),
    )

    def __repr__(self) -> str:
        return f"<PromptTestResult id={self.id} run_id={self.run_id} status={self.status}>"
