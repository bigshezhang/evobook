"""API route path constants.

Centralized route path management for consistent API endpoints.
All router prefixes should reference these constants instead of hardcoded strings.
"""

# API Version
API_V1_PREFIX = "/api/v1"

# V1 Module Prefixes
PROFILE_PREFIX = "/profile"
ONBOARDING_PREFIX = "/onboarding"
COURSE_MAP_PREFIX = "/course-map"
NODE_CONTENT_PREFIX = "/node-content"
NODE_PROGRESS_PREFIX = "/node-progress"
QUIZ_PREFIX = "/quiz"
LEARNING_PREFIX = "/learning"
GAME_PREFIX = "/game"
SHOP_PREFIX = "/shop"
INVENTORY_PREFIX = "/inventory"
INVITE_PREFIX = "/invite"
DISCOVERY_PREFIX = "/discovery"

# Full Paths (for reference, computed from prefixes)
PROFILE_PATH = f"{API_V1_PREFIX}{PROFILE_PREFIX}"
ONBOARDING_PATH = f"{API_V1_PREFIX}{ONBOARDING_PREFIX}"
COURSE_MAP_PATH = f"{API_V1_PREFIX}{COURSE_MAP_PREFIX}"
NODE_CONTENT_PATH = f"{API_V1_PREFIX}{NODE_CONTENT_PREFIX}"
NODE_PROGRESS_PATH = f"{API_V1_PREFIX}{NODE_PROGRESS_PREFIX}"
QUIZ_PATH = f"{API_V1_PREFIX}{QUIZ_PREFIX}"
LEARNING_PATH = f"{API_V1_PREFIX}{LEARNING_PREFIX}"
GAME_PATH = f"{API_V1_PREFIX}{GAME_PREFIX}"
SHOP_PATH = f"{API_V1_PREFIX}{SHOP_PREFIX}"
INVENTORY_PATH = f"{API_V1_PREFIX}{INVENTORY_PREFIX}"
INVITE_PATH = f"{API_V1_PREFIX}{INVITE_PREFIX}"
DISCOVERY_PATH = f"{API_V1_PREFIX}{DISCOVERY_PREFIX}"
