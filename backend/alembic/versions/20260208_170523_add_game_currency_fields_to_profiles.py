"""add_game_currency_fields_to_profiles

Revision ID: 8e03f523c9cb
Revises: 340e2ebf056a
Create Date: 2026-02-08 17:05:23.995571

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8e03f523c9cb'
down_revision: Union[str, None] = '340e2ebf056a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add game currency and progress fields to profiles table."""
    # Add game currency fields
    op.add_column(
        'profiles',
        sa.Column(
            'gold_balance',
            sa.Integer(),
            nullable=False,
            server_default=sa.text('0'),
            comment='金币余额',
        ),
    )
    op.add_column(
        'profiles',
        sa.Column(
            'dice_rolls_count',
            sa.Integer(),
            nullable=False,
            server_default=sa.text('15'),
            comment='骰子次数',
        ),
    )
    op.add_column(
        'profiles',
        sa.Column(
            'level',
            sa.Integer(),
            nullable=False,
            server_default=sa.text('1'),
            comment='用户等级',
        ),
    )
    op.add_column(
        'profiles',
        sa.Column(
            'current_exp',
            sa.Integer(),
            nullable=False,
            server_default=sa.text('0'),
            comment='当前经验值',
        ),
    )
    op.add_column(
        'profiles',
        sa.Column(
            'current_outfit',
            sa.Text(),
            nullable=False,
            server_default='default',
            comment='当前装备的服装',
        ),
    )
    op.add_column(
        'profiles',
        sa.Column(
            'travel_board_position',
            sa.Integer(),
            nullable=False,
            server_default=sa.text('0'),
            comment='地图位置',
        ),
    )


def downgrade() -> None:
    """Remove game currency and progress fields from profiles table."""
    op.drop_column('profiles', 'travel_board_position')
    op.drop_column('profiles', 'current_outfit')
    op.drop_column('profiles', 'current_exp')
    op.drop_column('profiles', 'level')
    op.drop_column('profiles', 'dice_rolls_count')
    op.drop_column('profiles', 'gold_balance')
