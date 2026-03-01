"""Stub migration to reconcile applied revision d1e2f3a4b5c6.

This revision was applied to the database but the original migration file
is no longer present. This stub allows Alembic to locate the revision and
continue the chain.

Revision ID: d1e2f3a4b5c6
Revises: 9a8b7c6d5e4f
Create Date: 2026-03-01 11:00:00.000000

"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, None] = '9a8b7c6d5e4f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """No-op: schema changes for this revision were already applied."""
    pass


def downgrade() -> None:
    """No-op: corresponding rollback not needed."""
    pass
