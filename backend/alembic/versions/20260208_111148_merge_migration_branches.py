"""merge migration branches

Revision ID: cc4c16f950b1
Revises: 8482922a2274, a9f8e7d6c5b4
Create Date: 2026-02-08 11:11:48.009316

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cc4c16f950b1'
down_revision: Union[str, None] = ('8482922a2274', 'a9f8e7d6c5b4')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    pass


def downgrade() -> None:
    """Downgrade database schema."""
    pass
