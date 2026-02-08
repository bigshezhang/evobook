# Game Currency API - Quick Start

## API 端点速览

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/v1/game/currency` | 获取货币和等级状态 |
| POST | `/api/v1/game/roll-dice` | 掷骰子（扣减1次） |
| POST | `/api/v1/game/claim-reward` | 领取奖励（金币/骰子/经验值） |
| POST | `/api/v1/game/earn-exp` | 获得经验值（可能升级） |

## 快速测试

### 1. 启动服务器

```bash
cd /Users/lazyman/Desktop/evobook_be
uvicorn app.main:app --reload
```

### 2. 设置认证 Token

```bash
export SUPABASE_TEST_TOKEN="your_jwt_token_here"
```

### 3. 运行测试脚本

```bash
./scripts/test_game_currency_api.sh
```

## 手动测试示例

### 获取货币状态

```bash
curl http://localhost:8000/api/v1/game/currency \
  -H "Authorization: Bearer $SUPABASE_TEST_TOKEN"
```

预期响应：
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

### 掷骰子

```bash
curl -X POST http://localhost:8000/api/v1/game/roll-dice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_TEST_TOKEN" \
  -d '{
    "course_map_id": "00000000-0000-0000-0000-000000000001",
    "current_position": 10
  }'
```

预期响应：
```json
{
  "success": true,
  "dice_result": 3,
  "dice_rolls_remaining": 14,
  "message": "Dice rolled successfully"
}
```

### 领取金币奖励

```bash
curl -X POST http://localhost:8000/api/v1/game/claim-reward \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_TEST_TOKEN" \
  -d '{
    "reward_type": "gold",
    "amount": 150,
    "source": "tile_reward",
    "source_details": {
      "tile_position": 15,
      "tile_type": "gold"
    }
  }'
```

预期响应：
```json
{
  "success": true,
  "reward_type": "gold",
  "amount": 150,
  "new_balance": 12600,
  "message": "Reward claimed successfully"
}
```

### 获得经验值（可能升级）

```bash
curl -X POST http://localhost:8000/api/v1/game/earn-exp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_TEST_TOKEN" \
  -d '{
    "exp_amount": 500,
    "source": "learning_reward",
    "source_details": {
      "node_id": 5,
      "activity_type": "knowledge_card_complete"
    }
  }'
```

预期响应（升级）：
```json
{
  "success": true,
  "exp_earned": 500,
  "current_exp": 12,
  "current_level": 15,
  "level_up": true,
  "rewards": {
    "gold": 100,
    "dice_rolls": 2
  }
}
```

## 等级系统

### 经验值公式

- Level 1 → 2: 100 EXP
- Level 2 → 3: 150 EXP
- Level N → N+1: `100 + 50 × (N-1)` EXP

### 升级奖励

每升一级获得：
- **100 金币**
- **2 个骰子**

多级跳跃会累计奖励（例如：升 2 级 = 200 金币 + 4 骰子）

## 错误处理

| 错误码 | 状态码 | 说明 |
|--------|--------|------|
| `INSUFFICIENT_DICE` | 400 | 骰子数量不足 |
| `INVALID_REWARD_TYPE` | 400 | 奖励类型无效（必须是 gold/dice/exp） |
| `INVALID_AMOUNT` | 400 | 金额必须为正数 |
| `PROFILE_NOT_FOUND` | 404 | 用户档案不存在 |

错误响应格式：
```json
{
  "detail": {
    "code": "INSUFFICIENT_DICE",
    "message": "No dice rolls available"
  }
}
```

## 事务记录

所有货币变动都会记录到 `game_transactions` 表：

```sql
SELECT * FROM game_transactions
WHERE user_id = 'your-user-id'
ORDER BY created_at DESC
LIMIT 10;
```

字段说明：
- `transaction_type`: earn_gold, spend_gold, earn_dice, use_dice, earn_exp
- `amount`: 正数=获得，负数=消耗
- `source`: tile_reward, learning_reward, dice_roll, level_up_reward, etc.
- `source_detail`: JSON 格式的详细信息

## 完整文档

详细 API 文档和实现说明，请参阅：
- [Game Currency API Implementation](./game_currency_api_implementation.md)
