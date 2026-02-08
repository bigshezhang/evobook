"""Error codes for API responses.

Centralized error code constants to ensure consistency across the application.
"""

# ==================== Common Errors ====================
ERROR_INTERNAL = "INTERNAL_ERROR"
ERROR_UNKNOWN = "UNKNOWN_ERROR"
ERROR_INVALID_UUID = "INVALID_UUID"
ERROR_INVALID_PARAMETER = "INVALID_PARAMETER"
ERROR_INVALID_DAYS = "INVALID_DAYS"
ERROR_INVALID_TOKEN = "INVALID_TOKEN"

# ==================== Resource Not Found ====================
ERROR_PROFILE_NOT_FOUND = "PROFILE_NOT_FOUND"
ERROR_COURSE_NOT_FOUND = "COURSE_NOT_FOUND"
ERROR_NODE_NOT_FOUND = "NODE_NOT_FOUND"
ERROR_ITEM_NOT_FOUND = "ITEM_NOT_FOUND"
ERROR_NOT_FOUND = "NOT_FOUND"

# ==================== Insufficient Resources ====================
ERROR_INSUFFICIENT_DICE = "INSUFFICIENT_DICE"
ERROR_INSUFFICIENT_GOLD = "INSUFFICIENT_GOLD"

# ==================== Validation Errors ====================
ERROR_INVALID_AMOUNT = "INVALID_AMOUNT"
ERROR_INVALID_REWARD_TYPE = "INVALID_REWARD_TYPE"

# ==================== Invite Errors ====================
ERROR_INVITE_ALREADY_BOUND = "ALREADY_BOUND"
ERROR_INVITE_INVALID_CODE = "INVALID_CODE"
ERROR_INVITE_SELF_INVITE = "SELF_INVITE"

# ==================== Ownership Errors ====================
ERROR_ITEM_NOT_OWNED = "ITEM_NOT_OWNED"
