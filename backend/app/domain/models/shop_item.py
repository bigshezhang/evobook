"""Shop item domain model."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Integer, Text, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database import Base


class ShopItem(Base):
    """Shop item that can be purchased by users.

    Represents items available in the shop (clothes, furniture, etc.).
    """

    __tablename__ = "shop_items"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
        comment="Primary key",
    )
    name: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Item display name",
    )
    item_type: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Type of item: 'clothes', 'furniture'",
    )
    price: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Gold price",
    )
    image_path: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Path to item image",
    )
    rarity: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="common",
        server_default="common",
        comment="Rarity: 'common', 'rare', 'epic', 'legendary'",
    )
    is_default: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
        comment="Whether this is a default/starter item",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        default=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return f"<ShopItem id={self.id} name={self.name} type={self.item_type}>"
