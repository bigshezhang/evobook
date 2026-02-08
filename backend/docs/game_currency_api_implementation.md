# Game Currency System API Implementation

## Overview

Implemented a complete game currency system API for EvoBook, including:
- Gold balance management
- Dice rolls management
- Experience points and level progression
- Automatic level-up rewards (100 gold + 2 dice per level)

## API Endpoints Implemented

### 1. GET /api/v1/game/currency

Get user's current currency and level status.

**Response:**
```json
{
  "gold_balance": 12450,
  "dice_rolls_count": 15,
  "level": 14,
  "current_exp": 42,
  "exp_to_next_level": 60,
  "exp_progress_percent": 70.0
}
```

**curl example:**
```bash
curl -X GET http://localhost:8000/api/v1/game/currency \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 2. POST /api/v1/game/roll-dice

Roll dice and deduct one dice roll from user's balance.

**Request:**
```json
{
  "course_map_id": "uuid",
  "current_position": 10
}
```

**Response:**
```json
{
  "success": true,
  "dice_result": 3,
  "dice_rolls_remaining": 14,
  "message": "Dice rolled successfully"
}
```

**Error Responses:**
- `400 INSUFFICIENT_DICE` - No dice rolls available

**curl example:**
```bash
curl -X POST http://localhost:8000/api/v1/game/roll-dice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "course_map_id": "00000000-0000-0000-0000-000000000001",
    "current_position": 10
  }'
```

---

### 3. POST /api/v1/game/claim-reward

Claim a reward (gold, dice, or exp).

**Request:**
```json
{
  "reward_type": "gold",
  "amount": 150,
  "source": "tile_reward",
  "source_details": {
    "course_map_id": "uuid",
    "tile_position": 15,
    "tile_type": "gold"
  }
}
```

**Response:**
```json
{
  "success": true,
  "reward_type": "gold",
  "amount": 150,
  "new_balance": 12600,
  "message": "Reward claimed successfully"
}
```

**Error Responses:**
- `400 INVALID_REWARD_TYPE` - Reward type must be 'gold', 'dice', or 'exp'
- `400 INVALID_AMOUNT` - Amount must be positive

**curl examples:**

Gold reward:
```bash
curl -X POST http://localhost:8000/api/v1/game/claim-reward \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "reward_type": "gold",
    "amount": 150,
    "source": "tile_reward",
    "source_details": {
      "course_map_id": "00000000-0000-0000-0000-000000000001",
      "tile_position": 15,
      "tile_type": "gold"
    }
  }'
```

Dice reward:
```bash
curl -X POST http://localhost:8000/api/v1/game/claim-reward \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "reward_type": "dice",
    "amount": 3,
    "source": "tile_reward",
    "source_details": {
      "course_map_id": "00000000-0000-0000-0000-000000000001",
      "tile_position": 20,
      "tile_type": "dice"
    }
  }'
```

Exp reward:
```bash
curl -X POST http://localhost:8000/api/v1/game/claim-reward \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "reward_type": "exp",
    "amount": 50,
    "source": "tile_reward",
    "source_details": {
      "course_map_id": "00000000-0000-0000-0000-000000000001",
      "tile_position": 25,
      "tile_type": "exp"
    }
  }'
```

---

### 4. POST /api/v1/game/earn-exp

Earn experience points, potentially triggering level up with rewards.

**Level Up Rewards:**
- 100 gold per level
- 2 dice rolls per level

**Request:**
```json
{
  "exp_amount": 50,
  "source": "learning_reward",
  "source_details": {
    "course_map_id": "uuid",
    "node_id": 5,
    "activity_type": "knowledge_card_complete"
  }
}
```

**Response (no level up):**
```json
{
  "success": true,
  "exp_earned": 50,
  "current_exp": 92,
  "current_level": 14,
  "level_up": false,
  "rewards": null
}
```

**Response (with level up):**
```json
{
  "success": true,
  "exp_earned": 50,
  "current_exp": 12,
  "current_level": 15,
  "level_up": true,
  "rewards": {
    "gold": 100,
    "dice_rolls": 2
  }
}
```

**Error Responses:**
- `400 INVALID_AMOUNT` - EXP amount must be positive

**curl example:**
```bash
curl -X POST http://localhost:8000/api/v1/game/earn-exp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "exp_amount": 50,
    "source": "learning_reward",
    "source_details": {
      "course_map_id": "00000000-0000-0000-0000-000000000001",
      "node_id": 5,
      "activity_type": "knowledge_card_complete"
    }
  }'
```

---

## Implementation Details

### Service Layer

**File:** `app/domain/services/game_service.py`

Key methods implemented:
- `get_user_currency(user_id, db)` - Get currency status with progress percentage
- `roll_dice(user_id, db, course_map_id, current_position)` - Roll dice with validation
- `claim_reward(user_id, reward_type, amount, source, db, source_details)` - Claim any reward type
- `earn_exp(user_id, amount, source, db, source_details)` - Earn EXP with automatic level up and rewards

### Level Progression Formula

**EXP to Next Level:**
- Level 1 → 2: 100 EXP
- Level 2 → 3: 150 EXP
- Level N → N+1: 100 + 50 × (N-1) EXP

**Level Up Rewards:**
- Gold: 100 per level
- Dice Rolls: 2 per level

Example: If a user levels up from level 10 to level 12 (2 levels), they receive:
- 200 gold (100 × 2)
- 4 dice rolls (2 × 2)

### Transaction Recording

All currency changes are recorded in the `game_transactions` table with:
- `transaction_type`: 'earn_gold', 'spend_gold', 'earn_dice', 'use_dice', 'earn_exp'
- `amount`: Positive for earn, negative for spend/use
- `source`: Source identifier (e.g., 'tile_reward', 'learning_reward', 'dice_roll', 'level_up_reward')
- `source_detail`: JSON object with contextual information

### Concurrent Safety

The implementation uses database transactions and SELECT FOR UPDATE (where needed) to prevent race conditions when multiple requests modify the same user's currency simultaneously.

---

## Error Handling

All errors follow the standard error format:

```json
{
  "detail": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

**Error Codes:**
- `PROFILE_NOT_FOUND` (404) - User profile not found
- `INSUFFICIENT_DICE` (400) - No dice rolls available
- `INVALID_REWARD_TYPE` (400) - Invalid reward type
- `INVALID_AMOUNT` (400) - Amount must be positive
- `INVALID_UUID` (400) - Invalid UUID format
- `INTERNAL_ERROR` (500) - Unexpected server error

---

## Testing

### Automated Test Script

Run the comprehensive test suite:

```bash
# Set your authentication token
export SUPABASE_TEST_TOKEN="your_jwt_token_here"

# Run tests
./scripts/test_game_currency_api.sh
```

The test script covers:
- ✓ Get currency status
- ✓ Roll dice (success and insufficient dice error)
- ✓ Claim gold reward
- ✓ Claim dice reward
- ✓ Claim exp reward
- ✓ Earn EXP without level up
- ✓ Earn EXP with level up and rewards
- ✓ Error cases (invalid type, invalid amount)

### Manual Testing with curl

See individual endpoint sections above for curl examples.

---

## Database Schema

### Profile Model Fields (game currency related)

```python
gold_balance: int           # Gold coins, default 0
dice_rolls_count: int       # Dice rolls available, default 15
level: int                  # User level, default 1
current_exp: int            # Current EXP in level, default 0
```

### GameTransaction Model

```python
id: UUID                    # Primary key
user_id: UUID              # Foreign key to profiles
transaction_type: str      # earn_gold, spend_gold, earn_dice, use_dice, earn_exp
amount: int                # Positive for earn, negative for spend
source: str                # tile_reward, learning_reward, dice_roll, level_up_reward, etc.
source_detail: JSONB       # Additional context
created_at: datetime       # Transaction timestamp
```

---

## Files Changed/Created

### Modified Files:
- `app/domain/services/game_service.py` - Updated to match API contract
- `app/api/v1/game.py` - Updated endpoints and schemas

### Created Files:
- `scripts/test_game_currency_api.sh` - Comprehensive test script
- `docs/game_currency_api_implementation.md` - This documentation

### Already Registered:
- `app/api/v1/__init__.py` - Game router already registered

---

## Usage Example: Complete Flow

1. **Check initial status:**
```bash
curl http://localhost:8000/api/v1/game/currency \
  -H "Authorization: Bearer $TOKEN"
```

2. **Roll dice to move on the board:**
```bash
curl -X POST http://localhost:8000/api/v1/game/roll-dice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"course_map_id": "uuid", "current_position": 10}'
```

3. **Claim tile reward (gold):**
```bash
curl -X POST http://localhost:8000/api/v1/game/claim-reward \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "reward_type": "gold",
    "amount": 200,
    "source": "tile_reward",
    "source_details": {"tile_position": 15}
  }'
```

4. **Complete learning activity (earn EXP):**
```bash
curl -X POST http://localhost:8000/api/v1/game/earn-exp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "exp_amount": 100,
    "source": "learning_reward",
    "source_details": {"node_id": 5, "activity_type": "knowledge_card_complete"}
  }'
```

5. **Check updated status:**
```bash
curl http://localhost:8000/api/v1/game/currency \
  -H "Authorization: Bearer $TOKEN"
```

---

## Next Steps

The game currency system is now fully functional. Potential enhancements:

1. **Spending System:** Add endpoints for spending gold (shop, upgrades)
2. **Leaderboards:** Track and display top players by level/gold
3. **Daily Bonuses:** Grant daily dice rolls or gold
4. **Achievements:** Award currency for completing achievements
5. **Streak Bonuses:** Reward consistent learning activity

---

## Architecture Compliance

This implementation follows all project conventions:

✓ **Architecture:** Service layer in `domain/services`, API layer in `api/v1`
✓ **Error Handling:** Structured errors with codes and English messages
✓ **Logging:** Structured logs with key-value pairs in English
✓ **Type Hints:** Full type annotations on all functions
✓ **Transactions:** All currency changes use database transactions
✓ **Authentication:** All endpoints require JWT authentication
✓ **Validation:** Request models use Pydantic with proper constraints
✓ **Documentation:** Comprehensive docstrings in English

---

## Support

For issues or questions about the game currency system:
- Check logs in structured format
- Review transaction history in `game_transactions` table
- Use test script to verify functionality
