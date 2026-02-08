"""add_invite_system_tables

Revision ID: 5e1ac85e734c
Revises: d8198202a305
Create Date: 2026-02-08 17:47:06.142834

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5e1ac85e734c'
down_revision: Union[str, None] = 'd8198202a305'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    # Create user_invites table
    op.create_table(
        'user_invites',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('invite_code', sa.String(length=6), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
        sa.UniqueConstraint('invite_code'),
        sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ondelete='CASCADE'),
        comment='User invite codes'
    )
    op.create_index('idx_user_invites_code', 'user_invites', ['invite_code'])
    op.create_index('idx_user_invites_user_id', 'user_invites', ['user_id'])
    
    # Create invite_bindings table
    op.create_table(
        'invite_bindings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('inviter_id', sa.UUID(), nullable=False),
        sa.Column('invitee_id', sa.UUID(), nullable=False),
        sa.Column('invite_code', sa.String(length=6), nullable=False),
        sa.Column('bound_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('xp_granted', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('invitee_id'),
        sa.ForeignKeyConstraint(['inviter_id'], ['profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['invitee_id'], ['profiles.id'], ondelete='CASCADE'),
        comment='Invite binding relationships'
    )
    op.create_index('idx_invite_bindings_inviter', 'invite_bindings', ['inviter_id'])
    op.create_index('idx_invite_bindings_invitee', 'invite_bindings', ['invitee_id'])
    
    # Create user_rewards table (for future XP system integration)
    op.create_table(
        'user_rewards',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('reward_type', sa.String(length=50), nullable=False),
        sa.Column('xp_amount', sa.Integer(), nullable=False),
        sa.Column('source_user_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ondelete='CASCADE'),
        comment='User rewards history'
    )
    op.create_index('idx_user_rewards_user_id', 'user_rewards', ['user_id'])


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_index('idx_user_rewards_user_id', table_name='user_rewards')
    op.drop_table('user_rewards')
    
    op.drop_index('idx_invite_bindings_invitee', table_name='invite_bindings')
    op.drop_index('idx_invite_bindings_inviter', table_name='invite_bindings')
    op.drop_table('invite_bindings')
    
    op.drop_index('idx_user_invites_user_id', table_name='user_invites')
    op.drop_index('idx_user_invites_code', table_name='user_invites')
    op.drop_table('user_invites')
