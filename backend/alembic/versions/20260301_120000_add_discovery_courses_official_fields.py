"""add_discovery_courses_official_fields

Adds nodes, map_meta, source_course_map_id, tags columns to discovery_courses
to support storing pre-built official course content and enabling zero-AI-generation
clone-on-join flow.

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-03-01 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd6e7f8a9b0c1'
down_revision: Union[str, None] = 'c5d6e7f8a9b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add nodes, map_meta, source_course_map_id, tags columns to discovery_courses."""
    op.add_column(
        'discovery_courses',
        sa.Column(
            'nodes',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment='Full DAG nodes array copied from source course_map (used for join clone)',
        ),
    )
    op.add_column(
        'discovery_courses',
        sa.Column(
            'map_meta',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment='Course metadata copied from source course_map (course_name, strategy_rationale, etc.)',
        ),
    )
    op.add_column(
        'discovery_courses',
        sa.Column(
            'source_course_map_id',
            postgresql.UUID(as_uuid=True),
            nullable=True,
            comment='Source course_map UUID for traceability and node_contents cloning (no FK constraint)',
        ),
    )
    op.add_column(
        'discovery_courses',
        sa.Column(
            'tags',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="Display tags, e.g. ['适合新手', '无需基础']",
        ),
    )
    op.create_index(
        'idx_discovery_courses_source_course_map_id',
        'discovery_courses',
        ['source_course_map_id'],
    )


def downgrade() -> None:
    """Remove nodes, map_meta, source_course_map_id, tags columns from discovery_courses."""
    op.drop_index('idx_discovery_courses_source_course_map_id', table_name='discovery_courses')
    op.drop_column('discovery_courses', 'tags')
    op.drop_column('discovery_courses', 'source_course_map_id')
    op.drop_column('discovery_courses', 'map_meta')
    op.drop_column('discovery_courses', 'nodes')
