"""Add course_maps table

Revision ID: 8b3c2d1e4f5a
Revises: 47f79a81c1d8
Create Date: 2026-02-01 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8b3c2d1e4f5a'
down_revision: Union[str, None] = '47f79a81c1d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    op.create_table(
        'course_maps',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column(
            'topic',
            sa.Text(),
            nullable=False,
            comment='Learning topic from onboarding',
        ),
        sa.Column(
            'level',
            sa.Text(),
            nullable=False,
            comment='Novice | Beginner | Intermediate | Advanced',
        ),
        sa.Column(
            'focus',
            sa.Text(),
            nullable=False,
            comment="User's learning focus/goal",
        ),
        sa.Column(
            'verified_concept',
            sa.Text(),
            nullable=False,
            comment='Concept verified during onboarding',
        ),
        sa.Column(
            'mode',
            sa.Text(),
            nullable=False,
            comment='Deep | Fast | Light',
        ),
        sa.Column(
            'total_commitment_minutes',
            sa.Integer(),
            nullable=False,
            comment='Total time budget in minutes',
        ),
        sa.Column(
            'map_meta',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            comment='Course metadata: course_name, strategy_rationale, etc.',
        ),
        sa.Column(
            'nodes',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            comment='DAG nodes array with id, title, type, layer, pre_requisites, estimated_minutes',
        ),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('CURRENT_TIMESTAMP'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_course_maps_topic', 'course_maps', ['topic'], unique=False)
    op.create_index('idx_course_maps_mode', 'course_maps', ['mode'], unique=False)
    op.create_index('idx_course_maps_created_at', 'course_maps', ['created_at'], unique=False)


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_index('idx_course_maps_created_at', table_name='course_maps')
    op.drop_index('idx_course_maps_mode', table_name='course_maps')
    op.drop_index('idx_course_maps_topic', table_name='course_maps')
    op.drop_table('course_maps')
