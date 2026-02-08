"""add balance_after to game_transactions

Revision ID: d8198202a305
Revises: f5a137028de0
Create Date: 2026-02-08 17:11:56.470743

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd8198202a305'
down_revision: Union[str, None] = 'f5a137028de0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add balance_after field to game_transactions table."""
    op.add_column(
        'game_transactions',
        sa.Column(
            'balance_after',
            sa.Integer(),
            nullable=True,
            comment='Balance after this transaction (optional)',
        ),
    )


def downgrade() -> None:
    """Remove balance_after field from game_transactions table."""
    op.drop_column('game_transactions', 'balance_after')
