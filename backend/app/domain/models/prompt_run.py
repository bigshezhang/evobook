"""Prompt run domain model for LLM request tracing."""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Index, Integer, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database import Base


class PromptRun(Base):
    """Stores each LLM request/response trace."""
    
    __tablename__ = "prompt_runs"
    
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    request_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        unique=True,
        nullable=False,
    )
    prompt_name: Mapped[str] = mapped_column(Text, nullable=False)
    prompt_hash: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="sha256 hex of prompt text",
    )
    model: Mapped[str] = mapped_column(Text, nullable=False)
    success: Mapped[bool] = mapped_column(nullable=False)
    retries: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    raw_text: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Optionally truncated response text",
    )
    parsed_json: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        default=lambda: datetime.now(timezone.utc),
    )
    
    __table_args__ = (
        Index("idx_prompt_runs_prompt_name", "prompt_name"),
        Index("idx_prompt_runs_prompt_hash", "prompt_hash"),
        Index("idx_prompt_runs_created_at", "created_at"),
    )
    
    def __repr__(self) -> str:
        return f"<PromptRun id={self.id} prompt={self.prompt_name} success={self.success}>"
