"""add_active_course_fields_to_profiles

Add active_course_map_id, last_accessed_course_map_id, and last_accessed_at
to profiles table for tracking user's active and recently accessed courses.

Revision ID: 7cd1090b7360
Revises: a1b2c3d4e5f6
Create Date: 2026-02-07 22:06:53.601484

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7cd1090b7360'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    # Add active_course_map_id column - user's explicitly set active course
    op.add_column(
        'profiles',
        sa.Column(
            'active_course_map_id',
            sa.UUID(),
            sa.ForeignKey('course_maps.id', ondelete='SET NULL'),
            nullable=True,
            comment='User-set active course for home page',
        ),
    )
    
    # Add last_accessed_course_map_id column - most recently accessed course
    op.add_column(
        'profiles',
        sa.Column(
            'last_accessed_course_map_id',
            sa.UUID(),
            sa.ForeignKey('course_maps.id', ondelete='SET NULL'),
            nullable=True,
            comment='Last accessed course map',
        ),
    )
    
    # Add last_accessed_at timestamp
    op.add_column(
        'profiles',
        sa.Column(
            'last_accessed_at',
            sa.DateTime(timezone=True),
            nullable=True,
            comment='Timestamp of last course access',
        ),
    )
    
    # Create indexes for better query performance
    op.create_index(
        'idx_profiles_active_course',
        'profiles',
        ['active_course_map_id'],
    )
    op.create_index(
        'idx_profiles_last_accessed_course',
        'profiles',
        ['last_accessed_course_map_id'],
    )


def downgrade() -> None:
    """Downgrade database schema."""
    # Drop indexes
    op.drop_index('idx_profiles_last_accessed_course', table_name='profiles')
    op.drop_index('idx_profiles_active_course', table_name='profiles')
    
    # Drop columns in reverse order
    op.drop_column('profiles', 'last_accessed_at')
    op.drop_column('profiles', 'last_accessed_course_map_id')
    op.drop_column('profiles', 'active_course_map_id')
