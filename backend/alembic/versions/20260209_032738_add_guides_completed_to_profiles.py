"""add_guides_completed_to_profiles

Revision ID: 9a8b7c6d5e4f
Revises: 4e51e1fbfc1a
Create Date: 2026-02-09 03:27:38.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '9a8b7c6d5e4f'
down_revision: Union[str, None] = '4e51e1fbfc1a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add guides_completed column to profiles table."""
    op.add_column(
        'profiles',
        sa.Column(
            'guides_completed',
            postgresql.ARRAY(sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'"),
            comment="List of completed guide IDs (e.g., 'knowledge_tree', 'quiz')",
        ),
    )


def downgrade() -> None:
    """Remove guides_completed column from profiles table."""
    op.drop_column('profiles', 'guides_completed')
