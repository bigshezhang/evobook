"""create discovery_courses table

Revision ID: 9d4e2b5c3a7f
Revises: 8c3f1a9b2d4e
Create Date: 2026-02-08 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '9d4e2b5c3a7f'
down_revision: Union[str, None] = '8c3f1a9b2d4e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create discovery_courses table."""
    op.create_table(
        'discovery_courses',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False, comment='Primary key'),
        sa.Column('preset_id', sa.Text(), nullable=False, comment="Unique preset identifier (e.g. 'quantum-physics-intro')"),
        sa.Column('title', sa.Text(), nullable=False, comment='Course display title'),
        sa.Column('description', sa.Text(), nullable=True, comment='Course description'),
        sa.Column('image_url', sa.Text(), nullable=True, comment='Course cover image URL'),
        sa.Column('category', sa.Text(), nullable=False, comment="Category: 'recommended', 'popular', 'friends'"),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0', comment='Display order within category (lower first)'),
        sa.Column('rating', sa.Numeric(precision=3, scale=1), nullable=False, server_default='4.5', comment='Course rating (0.0-5.0)'),
        sa.Column('seed_context', postgresql.JSONB(astext_type=sa.Text()), nullable=False, comment='Onboarding seed context: topic, suggested_level, key_concepts, focus'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true'), comment='Whether this course is visible in discovery'),
        sa.Column('view_count', sa.Integer(), nullable=False, server_default='0', comment='Number of times viewed'),
        sa.Column('start_count', sa.Integer(), nullable=False, server_default='0', comment='Number of times user clicked start/add'),
        sa.Column('completion_count', sa.Integer(), nullable=False, server_default='0', comment='Number of users who completed this course'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('preset_id'),
    )

    # Create indexes
    op.create_index('idx_discovery_courses_category', 'discovery_courses', ['category'])
    op.create_index('idx_discovery_courses_active', 'discovery_courses', ['is_active'])
    op.create_index('idx_discovery_courses_order', 'discovery_courses', ['category', 'display_order'])


def downgrade() -> None:
    """Drop discovery_courses table."""
    op.drop_index('idx_discovery_courses_order', table_name='discovery_courses')
    op.drop_index('idx_discovery_courses_active', table_name='discovery_courses')
    op.drop_index('idx_discovery_courses_category', table_name='discovery_courses')
    op.drop_table('discovery_courses')
