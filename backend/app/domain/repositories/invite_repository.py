"""Invite repository for invite system data access."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.invite import InviteBinding, UserInvite, UserReward
from app.domain.repositories.base import BaseRepository


class InviteRepository(BaseRepository[UserInvite]):
    """Repository for invite system entities data access."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize invite repository.

        Args:
            db: Async database session.
        """
        super().__init__(db, UserInvite)

    async def find_invite_by_user_id(self, user_id: UUID) -> UserInvite | None:
        """Find user's invite record.

        Args:
            user_id: User UUID.

        Returns:
            UserInvite instance or None.
        """
        stmt = select(UserInvite).where(UserInvite.user_id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def find_invite_by_code(self, invite_code: str) -> UserInvite | None:
        """Find an invite record by code.

        Args:
            invite_code: Invite code string.

        Returns:
            UserInvite instance or None.
        """
        stmt = select(UserInvite).where(UserInvite.invite_code == invite_code)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create_invite(self, invite: UserInvite) -> UserInvite:
        """Persist a new invite record.

        Args:
            invite: UserInvite entity.

        Returns:
            The saved invite.
        """
        self.db.add(invite)
        return invite

    async def count_successful_invites(self, user_id: UUID) -> int:
        """Count successful invites by a user.

        Args:
            user_id: Inviter user UUID.

        Returns:
            Number of successful invites.
        """
        stmt = select(func.count()).select_from(InviteBinding).where(
            InviteBinding.inviter_id == user_id
        )
        result = await self.db.execute(stmt)
        return result.scalar() or 0

    async def find_binding_by_invitee(
        self, invitee_id: UUID
    ) -> InviteBinding | None:
        """Find an invite binding by invitee.

        Args:
            invitee_id: Invitee user UUID.

        Returns:
            InviteBinding instance or None.
        """
        stmt = select(InviteBinding).where(InviteBinding.invitee_id == invitee_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create_binding(self, binding: InviteBinding) -> InviteBinding:
        """Persist a new invite binding.

        Args:
            binding: InviteBinding entity.

        Returns:
            The saved binding.
        """
        self.db.add(binding)
        return binding

    async def create_reward(self, reward: UserReward) -> UserReward:
        """Persist a new user reward.

        Args:
            reward: UserReward entity.

        Returns:
            The saved reward.
        """
        self.db.add(reward)
        return reward
