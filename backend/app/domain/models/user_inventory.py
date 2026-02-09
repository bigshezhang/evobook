"""User inventory domain model."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database import Base


class UserInventory(Base):
    """User's owned items.

    Tracks which items a user owns and whether they are equipped.
    """

    __tablename__ = "user_inventory"
    __table_args__ = (
        UniqueConstraint("user_id", "item_id", name="uq_user_inventory_user_item"),
    )

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
        index=True,
        comment="User who owns this item",
    )
    item_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("shop_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Shop item reference",
    )
    is_equipped: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
        comment="Whether item is currently equipped",
    )
    purchased_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        default=lambda: datetime.now(timezone.utc),
        comment="When the item was purchased",
    )

    def __repr__(self) -> str:
        return f"<UserInventory id={self.id} user_id={self.user_id} item_id={self.item_id}>"
