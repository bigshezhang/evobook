#!/bin/bash
# Quick test commands for Game Currency API
# Usage: ./scripts/quick_test_game_api.sh

TOKEN="${SUPABASE_TEST_TOKEN:-}"

if [ -z "$TOKEN" ]; then
  echo "❌ Error: SUPABASE_TEST_TOKEN not set"
  echo "   Set it with: export SUPABASE_TEST_TOKEN='your_jwt_token'"
  exit 1
fi

BASE_URL="http://localhost:8000/api/v1"

echo "🎮 EvoBook Game Currency API Quick Test"
echo ""

# Test 1: Get Currency
echo "1️⃣  GET /game/currency"
curl -s "$BASE_URL/game/currency" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# Test 2: Roll Dice
echo "2️⃣  POST /game/roll-dice"
curl -s -X POST "$BASE_URL/game/roll-dice" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "course_map_id": "00000000-0000-0000-0000-000000000001",
    "current_position": 10
  }' | jq '.'
echo ""

# Test 3: Claim Gold
echo "3️⃣  POST /game/claim-reward (gold)"
curl -s -X POST "$BASE_URL/game/claim-reward" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "reward_type": "gold",
    "amount": 100,
    "source": "tile_reward",
    "source_details": {"tile_position": 15}
  }' | jq '.'
echo ""

# Test 4: Earn EXP
echo "4️⃣  POST /game/earn-exp"
curl -s -X POST "$BASE_URL/game/earn-exp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "exp_amount": 50,
    "source": "learning_reward",
    "source_details": {"node_id": 5}
  }' | jq '.'
echo ""

echo "✅ Quick test complete!"
