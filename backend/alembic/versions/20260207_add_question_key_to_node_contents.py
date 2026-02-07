"""Add question_key column to node_contents with unique constraint

Adds a nullable TEXT column question_key to distinguish different clarification
and qa_detail entries for the same node.  Knowledge cards keep question_key=NULL.

Also adds a UNIQUE constraint on (course_map_id, node_id, content_type, question_key)
to prevent duplicate cached rows.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-07 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add question_key column and unique constraint for cache lookup."""
    # Step 1: Add the question_key column
    op.add_column(
        'node_contents',
        sa.Column(
            'question_key',
            sa.Text(),
            nullable=True,
            comment=(
                'Hash key to distinguish different questions for same node. '
                'NULL for knowledge_card, sha256[:16] of question text '
                'for clarification/qa_detail.'
            ),
        ),
    )

    # Step 2: Remove duplicate rows before adding unique constraint.
    # Keep only the newest row (by created_at) for each
    # (course_map_id, node_id, content_type, question_key) group.
    op.execute(sa.text("""
        DELETE FROM node_contents
        WHERE id NOT IN (
            SELECT DISTINCT ON (course_map_id, node_id, content_type, question_key) id
            FROM node_contents
            ORDER BY course_map_id, node_id, content_type, question_key, created_at DESC
        )
    """))

    # Step 3: Create unique constraint (replaces the old non-unique index)
    op.create_unique_constraint(
        'uq_node_contents_cache_key',
        'node_contents',
        ['course_map_id', 'node_id', 'content_type', 'question_key'],
    )


def downgrade() -> None:
    """Remove unique constraint (or legacy index) and question_key column."""
    # Use IF EXISTS to handle both old (index) and new (unique constraint) states
    op.execute(sa.text(
        "ALTER TABLE node_contents DROP CONSTRAINT IF EXISTS uq_node_contents_cache_key"
    ))
    op.execute(sa.text(
        "DROP INDEX IF EXISTS idx_node_contents_question_key"
    ))
    op.drop_column('node_contents', 'question_key')
