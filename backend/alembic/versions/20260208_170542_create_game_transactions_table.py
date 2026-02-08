"""create_game_transactions_table

Revision ID: 8f06f872b50a
Revises: 8e03f523c9cb
Create Date: 2026-02-08 17:05:42.282113

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision: str = '8f06f872b50a'
down_revision: Union[str, None] = '8e03f523c9cb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create game_transactions table for tracking all game currency changes."""
    op.create_table(
        'game_transactions',
        sa.Column(
            'id',
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text('gen_random_uuid()'),
            comment='Primary key',
        ),
        sa.Column(
            'user_id',
            UUID(as_uuid=True),
            sa.ForeignKey('profiles.id', ondelete='CASCADE'),
            nullable=False,
            comment='User who owns this transaction',
        ),
        sa.Column(
            'transaction_type',
            sa.Text(),
            nullable=False,
            comment='Type of transaction: earn_gold, spend_gold, earn_dice, use_dice, earn_exp',
        ),
        sa.Column(
            'amount',
            sa.Integer(),
            nullable=False,
            comment='Amount of currency (positive for earn, negative for spend)',
        ),
        sa.Column(
            'source',
            sa.Text(),
            nullable=False,
            comment='Source of transaction: tile_reward, learning_reward, shop_purchase, dice_roll',
        ),
        sa.Column(
            'source_detail',
            JSONB,
            nullable=True,
            comment='Detailed information (course_id, node_id, item_id, etc.)',
        ),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('CURRENT_TIMESTAMP'),
            comment='Transaction timestamp',
        ),
    )

    # Create indexes
    op.create_index(
        'idx_game_transactions_user_id',
        'game_transactions',
        ['user_id'],
    )
    op.create_index(
        'idx_game_transactions_created_at',
        'game_transactions',
        ['created_at'],
    )
    op.create_index(
        'idx_game_transactions_user_type',
        'game_transactions',
        ['user_id', 'transaction_type'],
    )


def downgrade() -> None:
    """Drop game_transactions table."""
    op.drop_index('idx_game_transactions_user_type')
    op.drop_index('idx_game_transactions_created_at')
    op.drop_index('idx_game_transactions_user_id')
    op.drop_table('game_transactions')
