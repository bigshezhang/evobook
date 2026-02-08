"""Domain constants for business logic.

Centralized constants for node types, statuses, levels, modes, and other
business rules to ensure consistency across the application.
"""

# ==================== Node Status ====================
NODE_STATUS_LOCKED = "locked"
NODE_STATUS_UNLOCKED = "unlocked"
NODE_STATUS_IN_PROGRESS = "in_progress"
NODE_STATUS_COMPLETED = "completed"

# Set of all valid node statuses
VALID_NODE_STATUSES = {
    NODE_STATUS_LOCKED,
    NODE_STATUS_UNLOCKED,
    NODE_STATUS_IN_PROGRESS,
    NODE_STATUS_COMPLETED,
}

# ==================== Node Types ====================
NODE_TYPE_LEARN = "learn"
NODE_TYPE_QUIZ = "quiz"

# Set of all valid node types
VALID_NODE_TYPES = {
    NODE_TYPE_LEARN,
    NODE_TYPE_QUIZ,
}

# ==================== Learning Levels ====================
LEVEL_NOVICE = "Novice"
LEVEL_BEGINNER = "Beginner"
LEVEL_INTERMEDIATE = "Intermediate"
LEVEL_ADVANCED = "Advanced"

# Set of all valid learning levels
VALID_LEVELS = {
    LEVEL_NOVICE,
    LEVEL_BEGINNER,
    LEVEL_INTERMEDIATE,
    LEVEL_ADVANCED,
}

# ==================== Learning Modes ====================
MODE_DEEP = "Deep"
MODE_FAST = "Fast"
MODE_LIGHT = "Light"

# Set of all valid learning modes
VALID_MODES = {
    MODE_DEEP,
    MODE_FAST,
    MODE_LIGHT,
}

# ==================== Reward Types ====================
REWARD_TYPE_GOLD = "gold"
REWARD_TYPE_DICE = "dice"
REWARD_TYPE_EXP = "exp"

# Set of all valid reward types
VALID_REWARD_TYPES = {
    REWARD_TYPE_GOLD,
    REWARD_TYPE_DICE,
    REWARD_TYPE_EXP,
}

# ==================== Business Rules ====================
# Invite code generation
INVITE_CODE_LENGTH = 6
INVITE_CODE_MAX_RETRIES = 3

# Dice game
DICE_MIN_VALUE = 1
DICE_MAX_VALUE = 4

# Node completion rewards
NODE_REWARD_QUIZ_EXP = 20
NODE_REWARD_REGULAR_EXP = 10

# Session reasons
SESSION_REASON_COURSE_NOT_FOUND = "COURSE_NOT_FOUND"
SESSION_REASON_NODE_NOT_FOUND = "NODE_NOT_FOUND"
