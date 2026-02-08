"""Onboarding state machine service.

This module implements the onboarding conversation state machine that guides
users through a structured dialogue to collect their learning profile.
"""

import json
from dataclasses import dataclass, field
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.domain.models.onboarding import OnboardingSession
from app.domain.models.profile import Profile
from app.llm.client import LLMClient
from app.llm.validators import OutputFormat
from app.prompts.registry import PromptName, PromptRegistry

logger = get_logger(__name__)


class OnboardingPhase(str, Enum):
    """Phases in the onboarding dialogue flow."""

    EXPLORATION = "exploration"
    CALIBRATION_R1 = "calibration_r1"
    CALIBRATION_R2 = "calibration_r2"
    FOCUS = "focus"
    MODE = "mode"
    SOURCE = "source"
    HANDOFF = "handoff"


class UserIntent(str, Enum):
    """User intent detected from conversation."""

    ADD_INFO = "add_info"
    CHANGE_TOPIC = "change_topic"


# Phase transition order for normal flow
PHASE_ORDER = [
    OnboardingPhase.EXPLORATION,
    OnboardingPhase.CALIBRATION_R1,
    OnboardingPhase.CALIBRATION_R2,
    OnboardingPhase.FOCUS,
    OnboardingPhase.MODE,
    OnboardingPhase.SOURCE,
    OnboardingPhase.HANDOFF,
]


@dataclass
class OnboardingState:
    """In-memory representation of onboarding session state."""

    session_id: UUID
    phase: OnboardingPhase
    topic: str | None = None
    level: str | None = None
    verified_concept: str | None = None
    focus: str | None = None
    mode: str | None = None
    source: str | None = None
    intent: UserIntent | None = None
    history: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Serialize state to dict for JSON storage.

        Returns:
            Dictionary representation of state.
        """
        return {
            "session_id": str(self.session_id),
            "phase": self.phase.value,
            "topic": self.topic,
            "level": self.level,
            "verified_concept": self.verified_concept,
            "focus": self.focus,
            "mode": self.mode,
            "source": self.source,
            "intent": self.intent.value if self.intent else None,
            "history": self.history,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "OnboardingState":
        """Deserialize state from dict.

        Args:
            data: Dictionary containing state data.

        Returns:
            OnboardingState instance.
        """
        return cls(
            session_id=UUID(data["session_id"]) if isinstance(data["session_id"], str) else data["session_id"],
            phase=OnboardingPhase(data["phase"]),
            topic=data.get("topic"),
            level=data.get("level"),
            verified_concept=data.get("verified_concept"),
            focus=data.get("focus"),
            mode=data.get("mode"),
            source=data.get("source"),
            intent=UserIntent(data["intent"]) if data.get("intent") else None,
            history=data.get("history", []),
        )

    @classmethod
    def new(cls, session_id: UUID | None = None) -> "OnboardingState":
        """Create a new onboarding state.

        Args:
            session_id: Optional session ID. Generated if not provided.

        Returns:
            New OnboardingState at exploration phase.
        """
        return cls(
            session_id=session_id or uuid4(),
            phase=OnboardingPhase.EXPLORATION,
            history=[],
        )


class OnboardingService:
    """Service for managing onboarding conversations.

    This service implements a state machine that guides users through
    the onboarding dialogue flow:
    1. exploration - Collect topic of interest
    2. calibration_r1 - First round skill assessment
    3. calibration_r2 - Second round skill assessment
    4. focus - Collect learning goals
    5. mode - Collect learning intensity preference
    6. source - Collect traffic source
    7. handoff - Complete and return profile
    """

    def __init__(self, llm_client: LLMClient, db_session: AsyncSession) -> None:
        """Initialize onboarding service.

        Args:
            llm_client: LLM client for generating responses.
            db_session: Database session for persistence.
        """
        self.llm = llm_client
        self.db = db_session

    async def process_next(
        self,
        session_id: UUID | None,
        user_message: str | None,
        user_choice: str | None,
        initial_topic: str | None = None,
        user_id: UUID | None = None,
    ) -> dict[str, Any]:
        """Process user input and return next response.

        Args:
            session_id: Existing session ID or None for new session.
            user_message: Free-form user message.
            user_choice: Selected option from previous response.
            initial_topic: Pre-selected topic to skip Phase 1 (Exploration).
            user_id: Optional authenticated user ID to associate with the session.

        Returns:
            Chat response dict with type "chat" or "finish".
        """
        # 1. Load or create session
        state = await self._load_or_create_state(session_id, user_id=user_id)

        # 1.5. If initial_topic provided for new session, skip to calibration phase
        if initial_topic and state.phase == OnboardingPhase.EXPLORATION and not state.topic:
            state.topic = initial_topic
            state.phase = OnboardingPhase.CALIBRATION_R1
            logger.info(
                "Skipping exploration phase with pre-selected topic",
                session_id=str(state.session_id),
                topic=initial_topic,
            )

        logger.info(
            "Processing onboarding step",
            session_id=str(state.session_id),
            phase=state.phase.value,
            has_message=user_message is not None,
            has_choice=user_choice is not None,
        )

        # 2. Add user input to history if provided
        user_input = user_message or user_choice
        if user_input:
            state.history.append({"role": "user", "content": user_input})

        # 3. Call LLM with conversation context
        llm_response = await self._call_llm(state)

        # 4. Parse LLM response
        response_data = llm_response.parsed_data
        if not isinstance(response_data, dict):
            response_data = {"type": "chat", "message": str(response_data), "options": []}

        # 5. Update state based on response
        state = self._update_state_from_response(state, response_data)

        # 6. Handle intent routing
        if state.intent == UserIntent.CHANGE_TOPIC:
            logger.info(
                "User changed topic, resetting to exploration",
                session_id=str(state.session_id),
            )
            state = self._reset_to_exploration(state)
            # Re-call LLM for fresh exploration response
            llm_response = await self._call_llm(state)
            response_data = llm_response.parsed_data
            if not isinstance(response_data, dict):
                response_data = {"type": "chat", "message": str(response_data), "options": []}

        # 7. Add assistant response to history
        state.history.append({"role": "assistant", "content": json.dumps(response_data)})

        # 8. Advance phase if needed (for chat responses)
        if response_data.get("type") == "chat":
            state = self._advance_phase_if_ready(state, response_data)

        # 9. Save state to DB
        await self._save_state(state)

        # 10. Mark profile onboarding_completed if finished and user is authenticated
        if response_data.get("type") == "finish" and user_id:
            await self._mark_onboarding_completed(user_id)

        # 11. Return appropriate response
        if response_data.get("type") == "finish":
            return {
                "type": "finish",
                "data": response_data.get("data", {}),
                "session_id": state.session_id,
            }
        else:
            return {
                "type": "chat",
                "message": response_data.get("message", ""),
                "options": response_data.get("options", []),
                "session_id": state.session_id,
            }

    async def _load_or_create_state(
        self, session_id: UUID | None, user_id: UUID | None = None
    ) -> OnboardingState:
        """Load existing session or create new one.

        Args:
            session_id: Session ID to load, or None for new session.
            user_id: Optional user ID to associate with the session.

        Returns:
            OnboardingState loaded or newly created.
        """
        if session_id is None:
            state = OnboardingState.new()
            # Store user_id for later persistence
            self._pending_user_id = user_id
            return state

        # Try to load from database
        stmt = select(OnboardingSession).where(OnboardingSession.id == session_id)
        result = await self.db.execute(stmt)
        session = result.scalar_one_or_none()

        if session is None:
            logger.warning(
                "Session not found, creating new",
                requested_session_id=str(session_id),
            )
            self._pending_user_id = user_id
            return OnboardingState.new()

        # If session has no user_id but caller is authenticated, backfill it
        if session.user_id is None and user_id is not None:
            session.user_id = user_id
            logger.info(
                "Backfilling user_id on existing session",
                session_id=str(session_id),
                user_id=str(user_id),
            )
        self._pending_user_id = user_id

        # Reconstruct state from DB
        state_data = session.state_json or {}
        state_data.update({
            "session_id": session.id,
            "phase": session.phase,
            "topic": session.topic,
            "level": session.level,
            "verified_concept": session.verified_concept,
            "focus": session.focus,
            "mode": session.mode,
            "source": session.source,
            "intent": session.intent,
        })
        return OnboardingState.from_dict(state_data)

    async def _save_state(self, state: OnboardingState) -> None:
        """Save state to database.

        Args:
            state: OnboardingState to persist.
        """
        # Try to load existing session
        stmt = select(OnboardingSession).where(OnboardingSession.id == state.session_id)
        result = await self.db.execute(stmt)
        session = result.scalar_one_or_none()

        if session is None:
            # Create new session with optional user_id
            session = OnboardingSession(
                id=state.session_id,
                user_id=getattr(self, "_pending_user_id", None),
                phase=state.phase.value,
                topic=state.topic,
                level=state.level,
                verified_concept=state.verified_concept,
                focus=state.focus,
                mode=state.mode,
                source=state.source,
                intent=state.intent.value if state.intent else None,
                state_json={"history": state.history},
            )
            self.db.add(session)
        else:
            # Update existing session
            session.phase = state.phase.value
            session.topic = state.topic
            session.level = state.level
            session.verified_concept = state.verified_concept
            session.focus = state.focus
            session.mode = state.mode
            session.source = state.source
            session.intent = state.intent.value if state.intent else None
            session.state_json = {"history": state.history}

        await self.db.commit()

        logger.info(
            "Session state saved",
            session_id=str(state.session_id),
            phase=state.phase.value,
        )

    async def _call_llm(self, state: OnboardingState) -> Any:
        """Call LLM with onboarding prompt and conversation history.

        Args:
            state: Current onboarding state.

        Returns:
            LLMResponse from client.
        """
        prompt_text = PromptRegistry.get_prompt(PromptName.ONBOARDING)

        # Build conversation context
        context = self._build_conversation_context(state)

        # Combine prompt with context
        full_prompt = f"{prompt_text}\n\n# Current Context\n{context}"

        response = await self.llm.complete(
            prompt_name="onboarding",
            prompt_text=full_prompt,
            output_format=OutputFormat.JSON,
        )

        return response

    def _build_conversation_context(self, state: OnboardingState) -> str:
        """Build conversation context string for LLM.

        Args:
            state: Current onboarding state.

        Returns:
            Formatted context string.
        """
        lines = [
            f"Phase: {state.phase.value}",
            f"Topic: {state.topic or 'Not set'}",
            f"Level: {state.level or 'Not set'}",
            f"Verified Concept: {state.verified_concept or 'Not set'}",
            f"Focus: {state.focus or 'Not set'}",
            f"Mode: {state.mode or 'Not set'}",
            f"Source: {state.source or 'Not set'}",
            "",
            "# Conversation History",
        ]

        for entry in state.history[-10:]:  # Limit to last 10 entries
            role = entry.get("role", "unknown")
            content = entry.get("content", "")
            lines.append(f"{role}: {content}")

        return "\n".join(lines)

    def _update_state_from_response(
        self,
        state: OnboardingState,
        response: dict[str, Any],
    ) -> OnboardingState:
        """Update state based on LLM response data.

        Args:
            state: Current state.
            response: Parsed LLM response.

        Returns:
            Updated state.
        """
        # Extract data from finish response
        if response.get("type") == "finish":
            data = response.get("data", {})
            state.topic = data.get("topic", state.topic)
            state.level = data.get("level", state.level)
            state.verified_concept = data.get("verified_concept", state.verified_concept)
            state.focus = data.get("focus", state.focus)
            state.mode = data.get("mode", state.mode)
            state.source = data.get("source", state.source)
            intent_str = data.get("intent")
            if intent_str:
                try:
                    state.intent = UserIntent(intent_str)
                except ValueError:
                    state.intent = UserIntent.ADD_INFO
            state.phase = OnboardingPhase.HANDOFF

        return state

    def _advance_phase_if_ready(
        self,
        state: OnboardingState,
        response: dict[str, Any],
    ) -> OnboardingState:
        """Advance to next phase if current phase is complete.

        Args:
            state: Current state.
            response: LLM response (for phase completion detection).

        Returns:
            State with potentially advanced phase.
        """
        # For simplicity, we advance phase based on conversation turns
        # In production, this would use more sophisticated detection
        current_idx = PHASE_ORDER.index(state.phase)
        if current_idx < len(PHASE_ORDER) - 1:
            # Check if we have enough turns to advance
            user_turns = sum(1 for h in state.history if h.get("role") == "user")
            if user_turns > 0 and state.phase != OnboardingPhase.HANDOFF:
                # Simple heuristic: advance after each user response
                next_phase = PHASE_ORDER[current_idx + 1]
                logger.debug(
                    "Advancing phase",
                    session_id=str(state.session_id),
                    from_phase=state.phase.value,
                    to_phase=next_phase.value,
                )
                state.phase = next_phase

        return state

    def _reset_to_exploration(self, state: OnboardingState) -> OnboardingState:
        """Reset state to exploration phase for topic change.

        Args:
            state: Current state.

        Returns:
            State reset to exploration with cleared topic-related fields.
        """
        state.phase = OnboardingPhase.EXPLORATION
        state.topic = None
        state.level = None
        state.verified_concept = None
        state.focus = None
        state.intent = None
        # Keep history for context, but clear profile data
        return state

    async def _mark_onboarding_completed(self, user_id: UUID) -> None:
        """Set onboarding_completed=True on the user's profile.

        Args:
            user_id: The authenticated user's UUID.
        """
        stmt = select(Profile).where(Profile.id == user_id)
        result = await self.db.execute(stmt)
        profile = result.scalar_one_or_none()

        if profile is None:
            logger.warning(
                "Profile not found when marking onboarding completed",
                user_id=str(user_id),
            )
            return

        profile.onboarding_completed = True
        await self.db.commit()

        logger.info(
            "Profile onboarding_completed set to True",
            user_id=str(user_id),
        )
