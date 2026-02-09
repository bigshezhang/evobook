"""Game transaction domain model."""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database import Base


class GameTransaction(Base):
    """Game currency transaction record.

    Tracks all changes to user currency (gold, dice, exp).
    """

    __tablename__ = "game_transactions"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
        comment="Primary key",
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        comment="User who owns this transaction",
    )
    transaction_type: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Type of transaction: earn_gold, spend_gold, earn_dice, use_dice, earn_exp",
    )
    amount: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Amount of currency (positive for earn, negative for spend)",
    )
    balance_after: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Balance after this transaction (optional)",
    )
    source: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Source of transaction: tile_reward, learning_reward, shop_purchase, dice_roll",
    )
    source_detail: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Detailed information (course_id, node_id, item_id, etc.)",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        default=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return f"<GameTransaction id={self.id} user_id={self.user_id} type={self.transaction_type} amount={self.amount}>"
