"""create_shop_items_and_user_inventory_tables

Revision ID: f5a137028de0
Revises: 8f06f872b50a
Create Date: 2026-02-08 17:10:55.612590

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f5a137028de0'
down_revision: Union[str, None] = '8f06f872b50a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    # Create shop_items table
    op.create_table(
        'shop_items',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False, comment='Primary key'),
        sa.Column('name', sa.Text(), nullable=False, comment='Item display name'),
        sa.Column('item_type', sa.Text(), nullable=False, comment="Type of item: 'clothes', 'furniture'"),
        sa.Column('price', sa.Integer(), nullable=False, comment='Gold price'),
        sa.Column('image_path', sa.Text(), nullable=False, comment='Path to item image'),
        sa.Column('rarity', sa.Text(), nullable=False, server_default='common', comment="Rarity: 'common', 'rare', 'epic', 'legendary'"),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default=sa.text('false'), comment='Whether this is a default/starter item'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_shop_items_item_type'), 'shop_items', ['item_type'])
    op.create_index(op.f('ix_shop_items_rarity'), 'shop_items', ['rarity'])

    # Create user_inventory table
    op.create_table(
        'user_inventory',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False, comment='Primary key'),
        sa.Column('user_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False, comment='User who owns this item'),
        sa.Column('item_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False, comment='Shop item reference'),
        sa.Column('is_equipped', sa.Boolean(), nullable=False, server_default=sa.text('false'), comment='Whether item is currently equipped'),
        sa.Column('purchased_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP'), comment='When the item was purchased'),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['item_id'], ['shop_items.id'], ondelete='CASCADE')
    )
    op.create_index(op.f('ix_user_inventory_user_id'), 'user_inventory', ['user_id'])
    op.create_index(op.f('ix_user_inventory_item_id'), 'user_inventory', ['item_id'])
    # Unique constraint: user can only own each item once
    op.create_unique_constraint('uq_user_inventory_user_item', 'user_inventory', ['user_id', 'item_id'])


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_table('user_inventory')
    op.drop_table('shop_items')
