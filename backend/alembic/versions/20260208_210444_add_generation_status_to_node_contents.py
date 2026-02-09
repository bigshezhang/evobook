"""add generation status to node_contents

Revision ID: a7a2077135e5
Revises: 5e1ac85e734c
Create Date: 2026-02-08 21:04:44.925282

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7a2077135e5'
down_revision: Union[str, None] = '5e1ac85e734c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    # Add generation status fields to node_contents table
    op.add_column('node_contents', sa.Column('generation_status', sa.String(50), nullable=False, server_default='pending'))
    op.add_column('node_contents', sa.Column('generation_started_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('node_contents', sa.Column('generation_completed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('node_contents', sa.Column('generation_error', sa.Text(), nullable=True))
    op.add_column('node_contents', sa.Column('node_type', sa.String(50), nullable=True))

    # Create index on generation_status for faster queries
    op.create_index('idx_node_contents_generation_status', 'node_contents', ['generation_status'])


def downgrade() -> None:
    """Downgrade database schema."""
    # Drop index and columns
    op.drop_index('idx_node_contents_generation_status', 'node_contents')
    op.drop_column('node_contents', 'node_type')
    op.drop_column('node_contents', 'generation_error')
    op.drop_column('node_contents', 'generation_completed_at')
    op.drop_column('node_contents', 'generation_started_at')
    op.drop_column('node_contents', 'generation_status')
