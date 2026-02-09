"""User statistics domain model for learning metrics."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, Integer, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database import Base


class UserStats(Base):
    """用户学习统计数据模型。

    用于存储和跟踪用户的学习时长、已完成课程数、掌握节点数等统计信息。
    主要用于 Profile 页面展示和全局排名计算。
    """

    __tablename__ = "user_stats"

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        primary_key=True,
        comment="用户 ID，外键关联 profiles.id",
    )
    total_study_seconds: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
        comment="总学习时长（秒）",
    )
    completed_courses_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
        comment="已完成课程数",
    )
    mastered_nodes_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
        comment="已掌握节点数（已完成的节点数）",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        comment="更新时间",
    )

    __table_args__ = (
        Index("idx_user_stats_study_time", text("total_study_seconds DESC")),
    )

    def __repr__(self) -> str:
        return f"<UserStats user_id={self.user_id} study_hours={self.total_study_seconds // 3600} completed={self.completed_courses_count}>"
