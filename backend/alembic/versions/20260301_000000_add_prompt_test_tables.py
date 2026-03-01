"""add_prompt_test_tables

Revision ID: a1b2c3d4e5f6
Revises: 9a8b7c6d5e4f
Create Date: 2026-03-01 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c5d6e7f8a9b0'
down_revision: Union[str, None] = 'd1e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create prompt_test_runs and prompt_test_results tables."""
    op.create_table(
        'prompt_test_runs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('prompt_name', sa.Text(), nullable=False, comment='Prompt name key (matches PromptName enum)'),
        sa.Column('prompt_text', sa.Text(), nullable=False, comment='Snapshot of the exact prompt text used (may differ from current file)'),
        sa.Column('prompt_hash', sa.Text(), nullable=False, comment='SHA256 of prompt_text'),
        sa.Column('course_map_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=False, comment='Array of course_map UUIDs selected for this test run'),
        sa.Column('status', sa.Text(), server_default='running', nullable=False, comment='running | completed | failed'),
        sa.Column('score', sa.Integer(), nullable=True, comment='1-5 rating assigned by user after review'),
        sa.Column('review_comment', sa.Text(), nullable=True, comment='Free-text review comment from user'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_prompt_test_runs_prompt_name', 'prompt_test_runs', ['prompt_name'])
    op.create_index('idx_prompt_test_runs_status', 'prompt_test_runs', ['status'])
    op.create_index('idx_prompt_test_runs_created_at', 'prompt_test_runs', ['created_at'])

    op.create_table(
        'prompt_test_results',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('run_id', postgresql.UUID(as_uuid=True), nullable=False, comment='Parent batch test run'),
        sa.Column('course_map_id', postgresql.UUID(as_uuid=True), nullable=False, comment='Course map used as test input'),
        sa.Column('input_variables', postgresql.JSONB(astext_type=sa.Text()), nullable=False, comment='Variables snapshot passed to the prompt template'),
        sa.Column('output_raw', sa.Text(), nullable=True, comment='Raw LLM text output'),
        sa.Column('output_parsed', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='Parsed output (dict) if prompt outputs JSON'),
        sa.Column('status', sa.Text(), server_default='pending', nullable=False, comment='pending | generating | completed | failed'),
        sa.Column('error_message', sa.Text(), nullable=True, comment='Error message when status=failed'),
        sa.Column('latency_ms', sa.Integer(), nullable=True, comment='LLM call latency in milliseconds'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['run_id'], ['prompt_test_runs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['course_map_id'], ['course_maps.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_prompt_test_results_run_id', 'prompt_test_results', ['run_id'])
    op.create_index('idx_prompt_test_results_course_map_id', 'prompt_test_results', ['course_map_id'])
    op.create_index('idx_prompt_test_results_status', 'prompt_test_results', ['status'])


def downgrade() -> None:
    """Drop prompt_test_runs and prompt_test_results tables."""
    op.drop_index('idx_prompt_test_results_status', table_name='prompt_test_results')
    op.drop_index('idx_prompt_test_results_course_map_id', table_name='prompt_test_results')
    op.drop_index('idx_prompt_test_results_run_id', table_name='prompt_test_results')
    op.drop_table('prompt_test_results')

    op.drop_index('idx_prompt_test_runs_created_at', table_name='prompt_test_runs')
    op.drop_index('idx_prompt_test_runs_status', table_name='prompt_test_runs')
    op.drop_index('idx_prompt_test_runs_prompt_name', table_name='prompt_test_runs')
    op.drop_table('prompt_test_runs')
