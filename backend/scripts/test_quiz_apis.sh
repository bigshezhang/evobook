#!/bin/bash
# Test script for Quiz History API endpoints

set -e

API_BASE="http://localhost:8000/api/v1"
TOKEN="${SUPABASE_TEST_TOKEN:-}"

if [ -z "$TOKEN" ]; then
  echo "⚠️  Warning: SUPABASE_TEST_TOKEN not set. API calls will fail without auth."
  echo "   Set it with: export SUPABASE_TEST_TOKEN='your_jwt_token'"
  echo ""
fi

AUTH_HEADER=""
if [ -n "$TOKEN" ]; then
  AUTH_HEADER="Authorization: Bearer $TOKEN"
fi

echo "════════════════════════════════════════════════════════"
echo "  Quiz History API Test Suite"
echo "════════════════════════════════════════════════════════"
echo ""

# Test 1: Health Check
echo "▸ Test 1: Health Check"
curl -s http://localhost:8000/healthz | jq '.' || echo "❌ Failed"
echo ""

# Test 2: Submit Quiz (requires auth)
echo "▸ Test 2: Submit Quiz Attempt"
if [ -z "$TOKEN" ]; then
  echo "⊘ Skipped (no auth token)"
else
  COURSE_MAP_ID="${TEST_COURSE_MAP_ID:-00000000-0000-0000-0000-000000000001}"
  NODE_ID="${TEST_NODE_ID:-1}"
  
  SUBMIT_RESPONSE=$(curl -s -X POST "$API_BASE/quiz/submit" \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d "{
      \"course_map_id\": \"$COURSE_MAP_ID\",
      \"node_id\": $NODE_ID,
      \"quiz_json\": {
        \"questions\": [{\"qtype\": \"single\", \"prompt\": \"Test?\", \"options\": [\"A\", \"B\"], \"answer\": \"A\"}],
        \"user_answers\": [{\"questionIdx\": 0, \"selected\": \"A\"}]
      },
      \"score\": 100
    }")
  
  echo "$SUBMIT_RESPONSE" | jq '.'
  
  # Extract attempt_id for next tests
  ATTEMPT_ID=$(echo "$SUBMIT_RESPONSE" | jq -r '.attempt_id // empty')
  
  if [ -n "$ATTEMPT_ID" ]; then
    echo "✓ Created attempt: $ATTEMPT_ID"
    
    # Test 3: Get History
    echo ""
    echo "▸ Test 3: Get Quiz History"
    curl -s "$API_BASE/quiz/history?course_map_id=$COURSE_MAP_ID&node_id=$NODE_ID" \
      -H "$AUTH_HEADER" | jq '.'
    
    # Test 4: Get Attempt Detail
    echo ""
    echo "▸ Test 4: Get Attempt Detail"
    curl -s "$API_BASE/quiz/attempt/$ATTEMPT_ID" \
      -H "$AUTH_HEADER" | jq '.'
  else
    echo "❌ Failed to create attempt"
  fi
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "  Test Complete"
echo "════════════════════════════════════════════════════════"
