#!/bin/bash
# Test script for Game API endpoints
# Usage: ./scripts/test_game_api.sh [TOKEN]

set -e

API_BASE="http://localhost:8000/api/v1"
TOKEN="${1:-}"

if [ -z "$TOKEN" ]; then
  echo "Usage: $0 <auth_token>"
  echo ""
  echo "Please provide a valid Supabase auth token."
  echo "You can get one by logging in through the frontend."
  exit 1
fi

echo "🎮 Testing Game API Endpoints"
echo "================================"
echo ""

# Test 1: Get Currency Status
echo "📊 Test 1: GET /game/currency"
curl -s -X GET "$API_BASE/game/currency" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq .
echo ""
echo ""

# Test 2: Roll Dice
echo "🎲 Test 2: POST /game/roll-dice"
curl -s -X POST "$API_BASE/game/roll-dice" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
echo ""
echo ""

# Test 3: Claim Gold Reward
echo "💰 Test 3: POST /game/claim-tile-reward (gold)"
curl -s -X POST "$API_BASE/game/claim-tile-reward" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reward_type": "gold",
    "amount": 100,
    "tile_id": 42
  }' | jq .
echo ""
echo ""

# Test 4: Claim Dice Reward
echo "🎲 Test 4: POST /game/claim-tile-reward (dice)"
curl -s -X POST "$API_BASE/game/claim-tile-reward" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reward_type": "dice",
    "amount": 1,
    "tile_id": 43
  }' | jq .
echo ""
echo ""

# Test 5: Earn EXP
echo "✨ Test 5: POST /game/earn-exp"
curl -s -X POST "$API_BASE/game/earn-exp" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50,
    "source": "learning_reward",
    "source_detail": {
      "node_id": 1,
      "node_type": "learn"
    }
  }' | jq .
echo ""
echo ""

# Test 6: Get Currency Status Again (verify changes)
echo "📊 Test 6: GET /game/currency (verify changes)"
curl -s -X GET "$API_BASE/game/currency" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq .
echo ""
echo ""

echo "✅ All tests completed!"
