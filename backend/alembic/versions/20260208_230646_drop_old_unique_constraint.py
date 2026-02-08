"""drop_old_unique_constraint

Revision ID: f85d7e130196
Revises: 4aff981b57f0
Create Date: 2026-02-08 23:06:46.663672

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f85d7e130196'
down_revision: Union[str, None] = '4aff981b57f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    # Drop the old unique index that uses COALESCE
    # This index conflicts with the new partial indexes
    op.drop_index('uq_node_contents_cache_key', 'node_contents')


def downgrade() -> None:
    """Downgrade database schema."""
    # Restore the old unique index using raw SQL (COALESCE is not supported in create_index)
    op.execute("""
        CREATE UNIQUE INDEX uq_node_contents_cache_key
        ON node_contents (course_map_id, node_id, content_type, COALESCE(question_key, ''))
    """)
