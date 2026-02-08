"""add_learning_activities_table

Create learning_activities table to track user learning history for activity heatmap.
Each record represents a completed node/quiz/knowledge_card event with UTC timestamp.

Revision ID: 8ef2a1b3c4d5
Revises: 7cd1090b7360
Create Date: 2026-02-07 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8ef2a1b3c4d5'
down_revision: Union[str, None] = '7cd1090b7360'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    # Create learning_activities table
    op.create_table(
        'learning_activities',
        sa.Column(
            'id',
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text('gen_random_uuid()'),
            comment='Primary key',
        ),
        sa.Column(
            'user_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('profiles.id', ondelete='CASCADE'),
            nullable=False,
            comment='User who completed this activity',
        ),
        sa.Column(
            'course_map_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('course_maps.id', ondelete='CASCADE'),
            nullable=False,
            comment='Course map this activity belongs to',
        ),
        sa.Column(
            'node_id',
            sa.Integer(),
            nullable=False,
            comment='DAG node ID within the course map',
        ),
        sa.Column(
            'activity_type',
            sa.Text(),
            nullable=False,
            comment='Activity type: node_completed | quiz_passed | knowledge_card_finished',
        ),
        sa.Column(
            'completed_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('CURRENT_TIMESTAMP'),
            comment='UTC timestamp when activity was completed',
        ),
        sa.Column(
            'extra_data',
            postgresql.JSONB(),
            nullable=True,
            comment='Optional extra data (e.g., score, time_spent_seconds)',
        ),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('CURRENT_TIMESTAMP'),
            comment='Record creation timestamp',
        ),
    )

    # Create indexes for efficient queries
    op.create_index(
        'idx_learning_activities_user_time',
        'learning_activities',
        ['user_id', sa.text('completed_at DESC')],
    )
    op.create_index(
        'idx_learning_activities_user_course',
        'learning_activities',
        ['user_id', 'course_map_id'],
    )
    op.create_index(
        'idx_learning_activities_type',
        'learning_activities',
        ['activity_type'],
    )


def downgrade() -> None:
    """Downgrade database schema."""
    # Drop indexes
    op.drop_index('idx_learning_activities_type', table_name='learning_activities')
    op.drop_index('idx_learning_activities_user_course', table_name='learning_activities')
    op.drop_index('idx_learning_activities_user_time', table_name='learning_activities')

    # Drop table
    op.drop_table('learning_activities')
