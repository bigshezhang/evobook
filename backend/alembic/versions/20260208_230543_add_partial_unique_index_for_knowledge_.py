"""add_partial_unique_index_for_knowledge_card

Revision ID: 4aff981b57f0
Revises: 9d4e2b5c3a7f
Create Date: 2026-02-08 23:05:43.382444

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4aff981b57f0'
down_revision: Union[str, None] = '9d4e2b5c3a7f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    # Create partial unique index for knowledge_card (where question_key IS NULL)
    # This allows ON CONFLICT to work properly for knowledge cards
    op.create_index(
        'uq_node_contents_knowledge_card',
        'node_contents',
        ['course_map_id', 'node_id', 'content_type'],
        unique=True,
        postgresql_where=sa.text('question_key IS NULL')
    )

    # Create partial unique index for clarifications/qa_detail (where question_key IS NOT NULL)
    # This ensures one content per question
    op.create_index(
        'uq_node_contents_with_question',
        'node_contents',
        ['course_map_id', 'node_id', 'content_type', 'question_key'],
        unique=True,
        postgresql_where=sa.text('question_key IS NOT NULL')
    )


def downgrade() -> None:
    """Downgrade database schema."""
    # Drop partial unique indexes
    op.drop_index('uq_node_contents_with_question', 'node_contents')
    op.drop_index('uq_node_contents_knowledge_card', 'node_contents')

    # Restore original unique constraint
    op.create_unique_constraint(
        'uq_node_contents_cache_key',
        'node_contents',
        ['course_map_id', 'node_id', 'content_type', 'question_key']
    )
