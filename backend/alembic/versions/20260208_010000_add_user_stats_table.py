"""add user_stats table for learning statistics

Revision ID: 20260208_010000
Revises: 20260207_230000
Create Date: 2026-02-08 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = 'a9f8e7d6c5b4'
down_revision: Union[str, None] = '8ef2a1b3c4d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """创建 user_stats 表用于存储用户学习统计数据。"""
    op.create_table(
        'user_stats',
        sa.Column('user_id', UUID(as_uuid=True), nullable=False, comment='用户 ID，外键关联 profiles.id'),
        sa.Column('total_study_seconds', sa.Integer(), nullable=False, server_default='0', comment='总学习时长（秒）'),
        sa.Column('completed_courses_count', sa.Integer(), nullable=False, server_default='0', comment='已完成课程数'),
        sa.Column('mastered_nodes_count', sa.Integer(), nullable=False, server_default='0', comment='已掌握节点数'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP'), comment='更新时间'),
        sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id'),
        comment='用户学习统计数据表'
    )

    # 创建索引：按学习时长倒序排序（用于排名查询）
    op.create_index(
        'idx_user_stats_study_time',
        'user_stats',
        [sa.text('total_study_seconds DESC')],
        unique=False
    )


def downgrade() -> None:
    """删除 user_stats 表及其索引。"""
    op.drop_index('idx_user_stats_study_time', table_name='user_stats')
    op.drop_table('user_stats')
