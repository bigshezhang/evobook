"""Add user auth tables and user_id columns

Create profiles, node_contents, node_progress, quiz_attempts tables.
Add user_id (nullable) to onboarding_sessions and course_maps.

Revision ID: a1b2c3d4e5f6
Revises: 8b3c2d1e4f5a
Create Date: 2026-02-07 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '8b3c2d1e4f5a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    # 1. Create profiles table (must come first, others reference it)
    op.create_table(
        'profiles',
        sa.Column('id', sa.UUID(), nullable=False, comment='Matches Supabase auth.users.id'),
        sa.Column('display_name', sa.Text(), nullable=True, comment='User display name'),
        sa.Column('mascot', sa.Text(), nullable=True, comment='Selected mascot/companion identifier'),
        sa.Column(
            'onboarding_completed',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('false'),
            comment='Whether user has completed onboarding',
        ),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('CURRENT_TIMESTAMP'),
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('CURRENT_TIMESTAMP'),
        ),
        sa.PrimaryKeyConstraint('id'),
    )

    # 2. Add user_id to existing tables
    op.add_column(
        'onboarding_sessions',
        sa.Column(
            'user_id',
            sa.UUID(),
            sa.ForeignKey('profiles.id', ondelete='SET NULL'),
            nullable=True,
            comment='Owner user, nullable for backward compatibility',
        ),
    )
    op.create_index('idx_onboarding_user_id', 'onboarding_sessions', ['user_id'])

    op.add_column(
        'course_maps',
        sa.Column(
            'user_id',
            sa.UUID(),
            sa.ForeignKey('profiles.id', ondelete='SET NULL'),
            nullable=True,
            comment='Owner user, nullable for backward compatibility',
        ),
    )
    op.create_index('idx_course_maps_user_id', 'course_maps', ['user_id'])

    # 3. Create node_contents table
    op.create_table(
        'node_contents',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column(
            'course_map_id',
            sa.UUID(),
            sa.ForeignKey('course_maps.id', ondelete='CASCADE'),
            nullable=False,
            comment='Which course map this content belongs to',
        ),
        sa.Column('node_id', sa.Integer(), nullable=False, comment='DAG node ID within the course map'),
        sa.Column(
            'content_type',
            sa.Text(),
            nullable=False,
            comment='knowledge_card | clarification | qa_detail',
        ),
        sa.Column(
            'content_json',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            comment='Full response content',
        ),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('CURRENT_TIMESTAMP'),
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_node_contents_course_map_id', 'node_contents', ['course_map_id'])
    op.create_index('idx_node_contents_course_node', 'node_contents', ['course_map_id', 'node_id'])
    op.create_index('idx_node_contents_type', 'node_contents', ['content_type'])

    # 4. Create node_progress table
    op.create_table(
        'node_progress',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column(
            'user_id',
            sa.UUID(),
            sa.ForeignKey('profiles.id', ondelete='CASCADE'),
            nullable=False,
            comment='Which user owns this progress',
        ),
        sa.Column(
            'course_map_id',
            sa.UUID(),
            sa.ForeignKey('course_maps.id', ondelete='CASCADE'),
            nullable=False,
            comment='Which course map this progress belongs to',
        ),
        sa.Column('node_id', sa.Integer(), nullable=False, comment='DAG node ID within the course map'),
        sa.Column(
            'status',
            sa.Text(),
            nullable=False,
            server_default=sa.text("'locked'"),
            comment='locked | unlocked | in_progress | completed',
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('CURRENT_TIMESTAMP'),
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'course_map_id', 'node_id', name='uq_user_course_node'),
    )
    op.create_index('idx_node_progress_user_id', 'node_progress', ['user_id'])
    op.create_index('idx_node_progress_course_map_id', 'node_progress', ['course_map_id'])

    # 5. Create quiz_attempts table
    op.create_table(
        'quiz_attempts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column(
            'user_id',
            sa.UUID(),
            sa.ForeignKey('profiles.id', ondelete='CASCADE'),
            nullable=False,
            comment='Which user took this quiz',
        ),
        sa.Column(
            'course_map_id',
            sa.UUID(),
            sa.ForeignKey('course_maps.id', ondelete='CASCADE'),
            nullable=False,
            comment='Which course map this quiz belongs to',
        ),
        sa.Column(
            'quiz_json',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            comment='Full quiz content: questions, options, correct answers, user answers',
        ),
        sa.Column(
            'score',
            sa.Integer(),
            nullable=True,
            comment='Quiz score (percentage or points)',
        ),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('CURRENT_TIMESTAMP'),
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_quiz_attempts_user_id', 'quiz_attempts', ['user_id'])
    op.create_index('idx_quiz_attempts_course_map_id', 'quiz_attempts', ['course_map_id'])
    op.create_index('idx_quiz_attempts_created_at', 'quiz_attempts', ['created_at'])


def downgrade() -> None:
    """Downgrade database schema."""
    # Drop new tables (reverse order)
    op.drop_index('idx_quiz_attempts_created_at', table_name='quiz_attempts')
    op.drop_index('idx_quiz_attempts_course_map_id', table_name='quiz_attempts')
    op.drop_index('idx_quiz_attempts_user_id', table_name='quiz_attempts')
    op.drop_table('quiz_attempts')

    op.drop_index('idx_node_progress_course_map_id', table_name='node_progress')
    op.drop_index('idx_node_progress_user_id', table_name='node_progress')
    op.drop_table('node_progress')

    op.drop_index('idx_node_contents_type', table_name='node_contents')
    op.drop_index('idx_node_contents_course_node', table_name='node_contents')
    op.drop_index('idx_node_contents_course_map_id', table_name='node_contents')
    op.drop_table('node_contents')

    # Remove user_id from existing tables
    op.drop_index('idx_course_maps_user_id', table_name='course_maps')
    op.drop_column('course_maps', 'user_id')

    op.drop_index('idx_onboarding_user_id', table_name='onboarding_sessions')
    op.drop_column('onboarding_sessions', 'user_id')

    # Drop profiles last (others reference it)
    op.drop_table('profiles')
