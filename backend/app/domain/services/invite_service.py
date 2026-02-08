"""Invite system business logic and utilities."""

import random
import string
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.domain.constants import INVITE_CODE_LENGTH, INVITE_CODE_MAX_RETRIES
from app.domain.models.invite import InviteBinding, UserInvite, UserReward
from app.domain.models.profile import Profile

logger = get_logger(__name__)


def generate_invite_code(length: int = INVITE_CODE_LENGTH) -> str:
    """Generate a random invite code (a-z A-Z).

    Args:
        length: Length of invite code (default from constants).

    Returns:
        Random string with mixed case letters.
    """
    chars = string.ascii_letters  # a-z A-Z
    return ''.join(random.choices(chars, k=length))


def format_invite_code(code: str) -> str:
    """Format invite code for display: EvoBook#AbCdEf.

    Args:
        code: Raw invite code.

    Returns:
        Formatted invite code with EvoBook# prefix.
    """
    return f"EvoBook#{code}"


class InviteService:
    """Service for managing invite codes and bindings."""

    @staticmethod
    async def get_or_create_invite_code(
        user_id: UUID,
        db: AsyncSession,
        base_url: str | None = None
    ) -> dict:
        """Get existing invite code or create a new one.

        Args:
            user_id: User ID to get/create invite code for.
            db: Database session.
            base_url: Base URL for invite links (defaults to config value).

        Returns:
            Dictionary with invite_code, formatted_code, invite_url, and successful_invites_count.

        Raises:
            Exception: If unable to generate unique invite code after max retries.
        """
        # Use config base_url if not provided
        if base_url is None:
            from app.config import get_settings
            base_url = get_settings().frontend_base_url

        # Check if user already has an invite code
        stmt = select(UserInvite).where(UserInvite.user_id == user_id)
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            invite_code = existing.invite_code
            logger.info("User invite code found", user_id=str(user_id), code=invite_code)
        else:
            # Generate new invite code with collision avoidance
            for attempt in range(INVITE_CODE_MAX_RETRIES):
                invite_code = generate_invite_code()
                # Check if code already exists
                check_stmt = select(UserInvite).where(UserInvite.invite_code == invite_code)
                check_result = await db.execute(check_stmt)
                if check_result.scalar_one_or_none() is None:
                    break
            else:
                logger.error("Failed to generate unique invite code", user_id=str(user_id))
                raise Exception(f"Failed to generate unique invite code after {INVITE_CODE_MAX_RETRIES} attempts")

            # Save new invite code
            new_invite = UserInvite(user_id=user_id, invite_code=invite_code)
            db.add(new_invite)
            await db.commit()
            logger.info("User invite code created", user_id=str(user_id), code=invite_code)

        # Count successful invites
        count_stmt = select(func.count()).select_from(InviteBinding).where(
            InviteBinding.inviter_id == user_id
        )
        count_result = await db.execute(count_stmt)
        successful_count = count_result.scalar() or 0

        return {
            "invite_code": invite_code,
            "formatted_code": format_invite_code(invite_code),
            "invite_url": f"{base_url}/register?invite={invite_code}",
            "successful_invites_count": successful_count,
        }

    @staticmethod
    async def bind_invite_code(
        invitee_id: UUID,
        invite_code: str,
        db: AsyncSession
    ) -> dict:
        """Bind a user to an invite code and grant rewards.

        Args:
            invitee_id: User ID of the person accepting the invite.
            invite_code: Invite code to bind.
            db: Database session.

        Returns:
            Dictionary with success status, inviter_name, and reward info.
        """
        # Check if user is already bound to an invite
        binding_stmt = select(InviteBinding).where(InviteBinding.invitee_id == invitee_id)
        binding_result = await db.execute(binding_stmt)
        existing_binding = binding_result.scalar_one_or_none()

        if existing_binding:
            from app.core.error_codes import ERROR_INVITE_ALREADY_BOUND
            logger.warning("User already bound to an invite", invitee_id=str(invitee_id))
            return {"success": False, "error": ERROR_INVITE_ALREADY_BOUND.lower().replace("_", "")}

        # Validate invite code exists
        invite_stmt = select(UserInvite).where(UserInvite.invite_code == invite_code)
        invite_result = await db.execute(invite_stmt)
        invite = invite_result.scalar_one_or_none()

        if not invite:
            from app.core.error_codes import ERROR_INVITE_INVALID_CODE
            logger.warning("Invalid invite code", code=invite_code)
            return {"success": False, "error": ERROR_INVITE_INVALID_CODE.lower().replace("_", "")}

        # Check self-invite
        if invite.user_id == invitee_id:
            from app.core.error_codes import ERROR_INVITE_SELF_INVITE
            logger.warning("User tried to use own invite code", user_id=str(invitee_id))
            return {"success": False, "error": ERROR_INVITE_SELF_INVITE.lower().replace("_", "")}

        # Create binding
        binding = InviteBinding(
            inviter_id=invite.user_id,
            invitee_id=invitee_id,
            invite_code=invite_code,
        )
        db.add(binding)

        # Grant XP rewards (500 XP each)
        inviter_reward = UserReward(
            user_id=invite.user_id,
            reward_type="invite_referrer",
            xp_amount=500,
            source_user_id=invitee_id,
        )
        invitee_reward = UserReward(
            user_id=invitee_id,
            reward_type="invite_referee",
            xp_amount=500,
            source_user_id=invite.user_id,
        )
        db.add(inviter_reward)
        db.add(invitee_reward)

        # Mark XP as granted
        binding.xp_granted = True

        await db.commit()

        # Get inviter profile for name
        profile_stmt = select(Profile).where(Profile.id == invite.user_id)
        profile_result = await db.execute(profile_stmt)
        inviter_profile = profile_result.scalar_one_or_none()
        inviter_name = inviter_profile.display_name if inviter_profile and inviter_profile.display_name else "EvoBook User"

        logger.info(
            "Invite binding created",
            inviter_id=str(invite.user_id),
            invitee_id=str(invitee_id),
            code=invite_code
        )

        return {
            "success": True,
            "inviter_name": inviter_name,
            "reward": {
                "xp_earned": 500,
                "message": f"You and {inviter_name} both earned +500 XP!"
            }
        }
