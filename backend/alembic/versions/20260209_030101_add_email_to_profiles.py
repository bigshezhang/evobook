"""add_email_to_profiles

Revision ID: 4e51e1fbfc1a
Revises: f85d7e130196
Create Date: 2026-02-09 03:01:01.005094

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '4e51e1fbfc1a'
down_revision: Union[str, None] = 'f85d7e130196'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add email column to profiles table."""
    op.add_column(
        'profiles',
        sa.Column(
            'email',
            sa.Text(),
            nullable=True,
            comment='User email, synced from Supabase JWT on each login',
        ),
    )
    op.create_unique_constraint('uq_profiles_email', 'profiles', ['email'])


def downgrade() -> None:
    """Remove email column from profiles table."""
    op.drop_constraint('uq_profiles_email', 'profiles', type_='unique')
    op.drop_column('profiles', 'email')
