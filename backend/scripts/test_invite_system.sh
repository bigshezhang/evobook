#!/bin/bash

# Test Invite System Implementation
# This script tests the invite system endpoints

set -e

API_BASE="http://localhost:8000/api/v1"
TOKEN="${EVOBOOK_TEST_TOKEN}"

if [ -z "$TOKEN" ]; then
  echo "❌ Error: EVOBOOK_TEST_TOKEN environment variable not set"
  echo "Please set it with a valid Supabase JWT token"
  echo "Example: export EVOBOOK_TEST_TOKEN='your_token_here'"
  exit 1
fi

echo "🧪 Testing EvoBook Invite System"
echo "================================="
echo ""

# Test 1: Get Profile Stats (should include invite code)
echo "📊 Test 1: Get Profile Stats with Invite Code"
echo "----------------------------------------------"
STATS_RESPONSE=$(curl -s -X GET "$API_BASE/profile/stats" \
  -H "Authorization: Bearer $TOKEN")

echo "$STATS_RESPONSE" | jq '.'

INVITE_CODE=$(echo "$STATS_RESPONSE" | jq -r '.invite_code')
SUCCESSFUL_INVITES=$(echo "$STATS_RESPONSE" | jq -r '.successful_invites_count')

if [ "$INVITE_CODE" != "null" ] && [ -n "$INVITE_CODE" ]; then
  echo "✅ Invite code found: $INVITE_CODE"
  echo "✅ Successful invites: $SUCCESSFUL_INVITES"
else
  echo "❌ Invite code not found in response"
  exit 1
fi

echo ""

# Test 2: Get Invite Code Endpoint
echo "🎫 Test 2: Get Invite Code Endpoint"
echo "------------------------------------"
INVITE_RESPONSE=$(curl -s -X GET "$API_BASE/profile/invite-code" \
  -H "Authorization: Bearer $TOKEN")

echo "$INVITE_RESPONSE" | jq '.'

FORMATTED_CODE=$(echo "$INVITE_RESPONSE" | jq -r '.formatted_code')
INVITE_URL=$(echo "$INVITE_RESPONSE" | jq -r '.invite_url')

if [ "$FORMATTED_CODE" != "null" ]; then
  echo "✅ Formatted code: $FORMATTED_CODE"
  echo "✅ Invite URL: $INVITE_URL"
else
  echo "❌ Failed to get invite code"
  exit 1
fi

echo ""

# Test 3: Bind Invite Code (expect error for self-invite)
echo "🔗 Test 3: Bind Invite Code (Self-Invite Test)"
echo "-----------------------------------------------"
BIND_RESPONSE=$(curl -s -X POST "$API_BASE/auth/bind-invite" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"invite_code\": \"$INVITE_CODE\"}")

echo "$BIND_RESPONSE" | jq '.'

ERROR_CODE=$(echo "$BIND_RESPONSE" | jq -r '.error.code')

if [ "$ERROR_CODE" == "SELF_INVITE" ]; then
  echo "✅ Self-invite correctly blocked"
else
  echo "⚠️  Expected SELF_INVITE error, got: $ERROR_CODE"
fi

echo ""
echo "================================="
echo "✅ All tests completed!"
echo ""
echo "📋 Summary:"
echo "- Invite Code: $INVITE_CODE"
echo "- Formatted: $FORMATTED_CODE"
echo "- Invite URL: $INVITE_URL"
echo "- Successful Invites: $SUCCESSFUL_INVITES"
echo ""
echo "🔗 Test the invite flow:"
echo "1. Share the invite URL with another user"
echo "2. They should register with ?invite=$INVITE_CODE"
echo "3. After authentication, they'll get +500 XP"
echo "4. You'll also get +500 XP"
echo ""
