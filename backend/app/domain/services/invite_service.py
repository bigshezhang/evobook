"""Invite system business logic and utilities."""

import random
import string
from uuid import UUID

from app.core.logging import get_logger
from app.domain.constants import INVITE_CODE_LENGTH, INVITE_CODE_MAX_RETRIES
from app.domain.models.invite import InviteBinding, UserInvite, UserReward
from app.domain.repositories.invite_repository import InviteRepository
from app.domain.repositories.profile_repository import ProfileRepository

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

    def __init__(
        self,
        invite_repo: InviteRepository,
        profile_repo: ProfileRepository,
    ) -> None:
        """Initialize invite service.

        Args:
            invite_repo: Repository for invite data access.
            profile_repo: Repository for profile data access.
        """
        self.invite_repo = invite_repo
        self.profile_repo = profile_repo

    async def get_or_create_invite_code(
        self,
        user_id: UUID,
        base_url: str | None = None,
    ) -> dict:
        """Get existing invite code or create a new one.

        Args:
            user_id: User ID to get/create invite code for.
            base_url: Base URL for invite links.

        Returns:
            Dictionary with invite_code, formatted_code, invite_url, and successful_invites_count.
        """
        if base_url is None:
            from app.config import get_settings
            base_url = get_settings().frontend_base_url

        # Check if user already has an invite code
        existing = await self.invite_repo.find_invite_by_user_id(user_id)

        if existing:
            invite_code = existing.invite_code
            logger.info("User invite code found", user_id=str(user_id), code=invite_code)
        else:
            # Generate new invite code with collision avoidance
            for attempt in range(INVITE_CODE_MAX_RETRIES):
                invite_code = generate_invite_code()
                check = await self.invite_repo.find_invite_by_code(invite_code)
                if check is None:
                    break
            else:
                logger.error("Failed to generate unique invite code", user_id=str(user_id))
                raise Exception(f"Failed to generate unique invite code after {INVITE_CODE_MAX_RETRIES} attempts")

            new_invite = UserInvite(user_id=user_id, invite_code=invite_code)
            await self.invite_repo.create_invite(new_invite)
            await self.invite_repo.commit()
            logger.info("User invite code created", user_id=str(user_id), code=invite_code)

        successful_count = await self.invite_repo.count_successful_invites(user_id)

        return {
            "invite_code": invite_code,
            "formatted_code": format_invite_code(invite_code),
            "invite_url": f"{base_url}/?invite={invite_code}#/login",
            "successful_invites_count": successful_count,
        }

    async def bind_invite_code(
        self,
        invitee_id: UUID,
        invite_code: str,
    ) -> dict:
        """Bind a user to an invite code and grant rewards.

        Args:
            invitee_id: User ID of the person accepting the invite.
            invite_code: Invite code to bind.

        Returns:
            Dictionary with success status, inviter_name, and reward info.
        """
        # Check if user is already bound
        existing_binding = await self.invite_repo.find_binding_by_invitee(invitee_id)
        if existing_binding:
            from app.core.error_codes import ERROR_INVITE_ALREADY_BOUND
            logger.warning("User already bound to an invite", invitee_id=str(invitee_id))
            return {"success": False, "error": ERROR_INVITE_ALREADY_BOUND.lower().replace("_", "")}

        # Validate invite code exists
        invite = await self.invite_repo.find_invite_by_code(invite_code)
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
            inviter_id=invite.user_id, invitee_id=invitee_id, invite_code=invite_code,
        )
        await self.invite_repo.create_binding(binding)

        # Grant XP rewards (500 XP each)
        inviter_reward = UserReward(user_id=invite.user_id, reward_type="invite_referrer", xp_amount=500, source_user_id=invitee_id)
        invitee_reward = UserReward(user_id=invitee_id, reward_type="invite_referee", xp_amount=500, source_user_id=invite.user_id)
        await self.invite_repo.create_reward(inviter_reward)
        await self.invite_repo.create_reward(invitee_reward)

        binding.xp_granted = True
        await self.invite_repo.commit()

        # Get inviter profile for name
        inviter_profile = await self.profile_repo.find_by_id(invite.user_id)
        inviter_name = inviter_profile.display_name if inviter_profile and inviter_profile.display_name else "EvoBook User"

        logger.info("Invite binding created", inviter_id=str(invite.user_id), invitee_id=str(invitee_id), code=invite_code)
        return {"success": True, "inviter_name": inviter_name, "reward": {"xp_earned": 500, "message": f"You and {inviter_name} both earned +500 XP!"}}
