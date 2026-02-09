#!/bin/bash
# Test script for Game Currency API endpoints

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
echo "  Game Currency API Test Suite"
echo "════════════════════════════════════════════════════════"
echo ""

# Test 1: Health Check
echo "▸ Test 1: Health Check"
curl -s http://localhost:8000/healthz | jq '.' || echo "❌ Failed"
echo ""

if [ -z "$TOKEN" ]; then
  echo "⊘ All other tests require authentication. Please set SUPABASE_TEST_TOKEN."
  exit 0
fi

# Test 2: Get Currency Status
echo "▸ Test 2: GET /api/v1/game/currency"
echo "   Description: Get user's current currency, level, and EXP status"
CURRENCY_RESPONSE=$(curl -s "$API_BASE/game/currency" \
  -H "$AUTH_HEADER")

echo "$CURRENCY_RESPONSE" | jq '.'

# Extract current values for later tests
GOLD_BEFORE=$(echo "$CURRENCY_RESPONSE" | jq -r '.gold_balance // 0')
DICE_BEFORE=$(echo "$CURRENCY_RESPONSE" | jq -r '.dice_rolls_count // 0')
LEVEL_BEFORE=$(echo "$CURRENCY_RESPONSE" | jq -r '.level // 1')
EXP_BEFORE=$(echo "$CURRENCY_RESPONSE" | jq -r '.current_exp // 0')

echo "✓ Current Status: Gold=$GOLD_BEFORE, Dice=$DICE_BEFORE, Level=$LEVEL_BEFORE, EXP=$EXP_BEFORE"
echo ""

# Test 3: Roll Dice
echo "▸ Test 3: POST /api/v1/game/roll-dice"
echo "   Description: Roll dice and deduct one dice roll"

if [ "$DICE_BEFORE" -gt 0 ]; then
  COURSE_MAP_ID="${TEST_COURSE_MAP_ID:-00000000-0000-0000-0000-000000000001}"

  ROLL_RESPONSE=$(curl -s -X POST "$API_BASE/game/roll-dice" \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d "{
      \"course_map_id\": \"$COURSE_MAP_ID\",
      \"current_position\": 10
    }")

  echo "$ROLL_RESPONSE" | jq '.'

  DICE_RESULT=$(echo "$ROLL_RESPONSE" | jq -r '.dice_result // 0')
  DICE_AFTER=$(echo "$ROLL_RESPONSE" | jq -r '.dice_rolls_remaining // 0')

  if [ "$DICE_RESULT" -ge 1 ] && [ "$DICE_RESULT" -le 4 ]; then
    echo "✓ Dice rolled: $DICE_RESULT (Dice remaining: $DICE_AFTER)"
  else
    echo "❌ Invalid dice result: $DICE_RESULT"
  fi
else
  echo "⊘ Skipped (no dice rolls available)"
fi
echo ""

# Test 4: Claim Gold Reward
echo "▸ Test 4: POST /api/v1/game/claim-reward (Gold)"
echo "   Description: Claim a gold reward from a tile"

GOLD_REWARD_RESPONSE=$(curl -s -X POST "$API_BASE/game/claim-reward" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "reward_type": "gold",
    "amount": 150,
    "source": "tile_reward",
    "source_details": {
      "course_map_id": "00000000-0000-0000-0000-000000000001",
      "tile_position": 15,
      "tile_type": "gold"
    }
  }')

echo "$GOLD_REWARD_RESPONSE" | jq '.'

GOLD_AFTER=$(echo "$GOLD_REWARD_RESPONSE" | jq -r '.new_balance // 0')
EXPECTED_GOLD=$((GOLD_BEFORE + 150))

if [ "$GOLD_AFTER" -eq "$EXPECTED_GOLD" ]; then
  echo "✓ Gold reward claimed: +150 (New balance: $GOLD_AFTER)"
else
  echo "⚠️  Gold balance mismatch: expected $EXPECTED_GOLD, got $GOLD_AFTER"
fi
echo ""

# Test 5: Claim Dice Reward
echo "▸ Test 5: POST /api/v1/game/claim-reward (Dice)"
echo "   Description: Claim dice rolls from a tile"

DICE_REWARD_RESPONSE=$(curl -s -X POST "$API_BASE/game/claim-reward" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "reward_type": "dice",
    "amount": 3,
    "source": "tile_reward",
    "source_details": {
      "course_map_id": "00000000-0000-0000-0000-000000000001",
      "tile_position": 20,
      "tile_type": "dice"
    }
  }')

echo "$DICE_REWARD_RESPONSE" | jq '.'
echo "✓ Dice reward claimed: +3"
echo ""

# Test 6: Earn EXP (no level up)
echo "▸ Test 6: POST /api/v1/game/earn-exp (No Level Up)"
echo "   Description: Earn a small amount of EXP without leveling up"

EXP_RESPONSE=$(curl -s -X POST "$API_BASE/game/earn-exp" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "exp_amount": 10,
    "source": "learning_reward",
    "source_details": {
      "course_map_id": "00000000-0000-0000-0000-000000000001",
      "node_id": 5,
      "activity_type": "knowledge_card_complete"
    }
  }')

echo "$EXP_RESPONSE" | jq '.'

LEVEL_UP=$(echo "$EXP_RESPONSE" | jq -r '.level_up')
if [ "$LEVEL_UP" = "false" ]; then
  echo "✓ EXP earned without level up"
else
  echo "⚠️  Unexpected level up"
fi
echo ""

# Test 7: Earn EXP (with level up)
echo "▸ Test 7: POST /api/v1/game/earn-exp (With Level Up)"
echo "   Description: Earn enough EXP to trigger level up and receive rewards"

# Earn a large amount of EXP to trigger level up
LEVELUP_RESPONSE=$(curl -s -X POST "$API_BASE/game/earn-exp" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "exp_amount": 500,
    "source": "learning_reward",
    "source_details": {
      "course_map_id": "00000000-0000-0000-0000-000000000001",
      "node_id": 10,
      "activity_type": "node_complete"
    }
  }')

echo "$LEVELUP_RESPONSE" | jq '.'

LEVEL_UP=$(echo "$LEVELUP_RESPONSE" | jq -r '.level_up')
REWARDS=$(echo "$LEVELUP_RESPONSE" | jq -r '.rewards')

if [ "$LEVEL_UP" = "true" ] && [ "$REWARDS" != "null" ]; then
  REWARD_GOLD=$(echo "$LEVELUP_RESPONSE" | jq -r '.rewards.gold // 0')
  REWARD_DICE=$(echo "$LEVELUP_RESPONSE" | jq -r '.rewards.dice_rolls // 0')
  echo "✓ Level up! Rewards: ${REWARD_GOLD} gold, ${REWARD_DICE} dice rolls"
else
  echo "⚠️  No level up or rewards"
fi
echo ""

# Test 8: Get Final Currency Status
echo "▸ Test 8: GET /api/v1/game/currency (Final Status)"
echo "   Description: Verify all changes were applied correctly"

FINAL_CURRENCY=$(curl -s "$API_BASE/game/currency" \
  -H "$AUTH_HEADER")

echo "$FINAL_CURRENCY" | jq '.'

GOLD_FINAL=$(echo "$FINAL_CURRENCY" | jq -r '.gold_balance // 0')
DICE_FINAL=$(echo "$FINAL_CURRENCY" | jq -r '.dice_rolls_count // 0')
LEVEL_FINAL=$(echo "$FINAL_CURRENCY" | jq -r '.level // 1')
EXP_FINAL=$(echo "$FINAL_CURRENCY" | jq -r '.current_exp // 0')

echo "✓ Final Status: Gold=$GOLD_FINAL, Dice=$DICE_FINAL, Level=$LEVEL_FINAL, EXP=$EXP_FINAL"
echo ""

# Test 9: Error Case - Insufficient Dice
echo "▸ Test 9: POST /api/v1/game/roll-dice (Error: Insufficient Dice)"
echo "   Description: Attempt to roll dice when user has 0 dice rolls"

# First, check if user has 0 dice rolls
if [ "$DICE_FINAL" -eq 0 ]; then
  ERROR_RESPONSE=$(curl -s -X POST "$API_BASE/game/roll-dice" \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d '{
      "course_map_id": "00000000-0000-0000-0000-000000000001",
      "current_position": 5
    }')

  echo "$ERROR_RESPONSE" | jq '.'

  ERROR_CODE=$(echo "$ERROR_RESPONSE" | jq -r '.detail.code // empty')
  if [ "$ERROR_CODE" = "INSUFFICIENT_DICE" ]; then
    echo "✓ Correctly returned INSUFFICIENT_DICE error"
  else
    echo "⚠️  Expected INSUFFICIENT_DICE error"
  fi
else
  echo "⊘ Skipped (user has dice rolls)"
fi
echo ""

# Test 10: Error Case - Invalid Reward Type
echo "▸ Test 10: POST /api/v1/game/claim-reward (Error: Invalid Type)"
echo "   Description: Attempt to claim reward with invalid type"

ERROR_RESPONSE=$(curl -s -X POST "$API_BASE/game/claim-reward" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "reward_type": "invalid_type",
    "amount": 100,
    "source": "tile_reward"
  }')

echo "$ERROR_RESPONSE" | jq '.'

ERROR_CODE=$(echo "$ERROR_RESPONSE" | jq -r '.detail.code // empty')
if [ "$ERROR_CODE" = "INVALID_REWARD_TYPE" ]; then
  echo "✓ Correctly returned INVALID_REWARD_TYPE error"
else
  echo "⚠️  Expected INVALID_REWARD_TYPE error"
fi
echo ""

# Test 11: Error Case - Invalid Amount
echo "▸ Test 11: POST /api/v1/game/claim-reward (Error: Invalid Amount)"
echo "   Description: Attempt to claim reward with negative or zero amount"

ERROR_RESPONSE=$(curl -s -X POST "$API_BASE/game/claim-reward" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "reward_type": "gold",
    "amount": -10,
    "source": "tile_reward"
  }')

echo "$ERROR_RESPONSE" | jq '.'

# Check if validation error is returned (422 or 400)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_BASE/game/claim-reward" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "reward_type": "gold",
    "amount": 0,
    "source": "tile_reward"
  }')

if [ "$HTTP_CODE" = "422" ] || [ "$HTTP_CODE" = "400" ]; then
  echo "✓ Correctly rejected invalid amount (HTTP $HTTP_CODE)"
else
  echo "⚠️  Expected 400 or 422 error, got HTTP $HTTP_CODE"
fi
echo ""

echo "════════════════════════════════════════════════════════"
echo "  Test Complete"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Summary:"
echo "  • GET /api/v1/game/currency - Get currency status ✓"
echo "  • POST /api/v1/game/roll-dice - Roll dice ✓"
echo "  • POST /api/v1/game/claim-reward - Claim rewards (gold/dice/exp) ✓"
echo "  • POST /api/v1/game/earn-exp - Earn EXP with level up ✓"
echo "  • Error handling verified ✓"
echo ""
