"""add language to course_maps

Revision ID: 8c3f1a9b2d4e
Revises: 6b0862b4086a
Create Date: 2026-02-08 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8c3f1a9b2d4e'
down_revision: Union[str, None] = '6b0862b4086a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add language column to course_maps table."""
    op.add_column(
        'course_maps',
        sa.Column(
            'language',
            sa.Text(),
            nullable=False,
            server_default='en',
            comment='User preferred language (ISO 639-1, e.g. en, zh)',
        ),
    )


def downgrade() -> None:
    """Remove language column from course_maps table."""
    op.drop_column('course_maps', 'language')
