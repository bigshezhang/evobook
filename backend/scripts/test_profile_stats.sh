#!/bin/bash
# Test profile stats endpoint with real auth token

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Profile Stats API Test ===${NC}\n"

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

API_BASE_URL="${API_BASE_URL:-http://localhost:8000}"

# Check if SUPABASE_TEST_TOKEN is set
if [ -z "$SUPABASE_TEST_TOKEN" ]; then
  echo -e "${RED}Error: SUPABASE_TEST_TOKEN not set${NC}"
  echo "Please set a valid Supabase auth token:"
  echo "  export SUPABASE_TEST_TOKEN='your-token-here'"
  exit 1
fi

echo -e "${GREEN}Step 1: Testing health endpoint${NC}"
curl -s "${API_BASE_URL}/healthz" | jq '.'
echo -e "\n"

echo -e "${GREEN}Step 2: Fetching profile stats${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${SUPABASE_TEST_TOKEN}" \
  -H "Content-Type: application/json" \
  "${API_BASE_URL}/api/v1/profile/stats")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response Body:"
echo "$BODY" | jq '.'

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "\n${GREEN}✓ Profile stats fetched successfully${NC}"
  
  # Extract fields
  USER_NAME=$(echo "$BODY" | jq -r '.user_name')
  JOINED_DATE=$(echo "$BODY" | jq -r '.joined_date')
  STUDY_SECONDS=$(echo "$BODY" | jq -r '.total_study_seconds')
  STUDY_HOURS=$(echo "$BODY" | jq -r '.total_study_hours')
  COMPLETED=$(echo "$BODY" | jq -r '.completed_courses_count')
  RANK=$(echo "$BODY" | jq -r '.global_rank')
  
  echo -e "\n${YELLOW}User Stats Summary:${NC}"
  echo "  User Name: $USER_NAME"
  echo "  Joined: $JOINED_DATE"
  echo "  Study Time: ${STUDY_HOURS}h (${STUDY_SECONDS}s)"
  echo "  Completed Courses: $COMPLETED"
  echo "  Global Rank: $RANK"
  
else
  echo -e "\n${RED}✗ Failed to fetch profile stats${NC}"
  exit 1
fi

echo -e "\n${GREEN}=== Test completed ===${NC}"
