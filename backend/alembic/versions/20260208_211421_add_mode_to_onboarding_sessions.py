"""add_mode_to_onboarding_sessions

Revision ID: 6b0862b4086a
Revises: a7a2077135e5
Create Date: 2026-02-08 21:14:21.628471

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6b0862b4086a'
down_revision: Union[str, None] = 'a7a2077135e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    op.add_column('onboarding_sessions', sa.Column('mode', sa.Text(), nullable=True, comment='Deep | Fast | Light'))


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_column('onboarding_sessions', 'mode')
