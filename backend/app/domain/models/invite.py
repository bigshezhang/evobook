"""Invite system domain models."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database import Base


class UserInvite(Base):
    """User invite code model.
    
    Each user can have one unique invite code.
    """
    
    __tablename__ = "user_invites"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        comment="User ID (matches profiles.id)",
    )
    invite_code: Mapped[str] = mapped_column(
        String(6),
        nullable=False,
        unique=True,
        comment="6-character invite code",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    
    def __repr__(self) -> str:
        return f"<UserInvite id={self.id} user_id={self.user_id} code={self.invite_code}>"


class InviteBinding(Base):
    """Invite binding relationship model.
    
    Tracks who invited whom. Each invitee can only be bound once.
    """
    
    __tablename__ = "invite_bindings"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    inviter_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        comment="User who sent the invite",
    )
    invitee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        comment="User who accepted the invite (can only be invited once)",
    )
    invite_code: Mapped[str] = mapped_column(
        String(6),
        nullable=False,
        comment="Invite code used",
    )
    bound_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    xp_granted: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        comment="Whether XP reward has been granted",
    )
    
    def __repr__(self) -> str:
        return f"<InviteBinding id={self.id} inviter={self.inviter_id} invitee={self.invitee_id}>"


class UserReward(Base):
    """User rewards history model.
    
    Tracks all XP and other rewards granted to users.
    """
    
    __tablename__ = "user_rewards"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        comment="User who received the reward",
    )
    reward_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Type of reward (e.g., 'invite_referrer', 'invite_referee')",
    )
    xp_amount: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Amount of XP granted",
    )
    source_user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        nullable=True,
        comment="Related user ID (e.g., who invited or was invited)",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    
    def __repr__(self) -> str:
        return f"<UserReward id={self.id} user_id={self.user_id} type={self.reward_type} xp={self.xp_amount}>"
