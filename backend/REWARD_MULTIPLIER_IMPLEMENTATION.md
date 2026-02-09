# Reward Multiplier 实现说明

## 概述

已将节点奖励系统从固定的节点类型倍率（如 quiz 固定 1.5x）改为由 LLM 生成的动态 `reward_multiplier` 机制。

## 实施更改

### 1. Prompt 更新

**文件**: `app/prompts/dag.txt`

- 新增奖励倍率规则（第 5 条）
- 更新 Output Schema，为每个节点添加 `reward_multiplier` 字段
- 奖励倍率指导原则：
  - 普通 learn 节点：1.0 - 1.2
  - 中等难度节点：1.3 - 1.8
  - Quiz 节点：1.5 - 2.0
  - 路径末端的关键汇合节点或最终 quiz：2.0 - 3.0（高奖励）

### 2. 服务层更新

**文件**: `app/domain/services/game_service.py`

```python
# 修改前：基于节点类型的固定倍率
async def calculate_learning_reward(
    node_type: str,
    estimated_minutes: int,
    actual_seconds: int | None = None,
) -> dict[str, int]:
    # ...
    if node_type == NODE_TYPE_QUIZ:
        base_gold = int(base_gold * 1.5)
        base_exp = int(base_exp * 1.5)

# 修改后：使用 LLM 生成的动态倍率
async def calculate_learning_reward(
    estimated_minutes: int,
    reward_multiplier: float = 1.0,
    actual_seconds: int | None = None,
) -> dict[str, int]:
    # ...
    base_gold = int(base_gold * reward_multiplier)
    base_exp = int(base_exp * reward_multiplier)
```

- 移除了对 `NODE_TYPE_QUIZ` 常量的依赖
- 参数从 `node_type` 改为 `reward_multiplier`
- 默认值为 1.0（基础奖励）

**文件**: `app/domain/services/course_map_service.py`

- 新增 `_validate_reward_multipliers()` 方法
- 验证所有节点都有 `reward_multiplier` 字段
- 验证倍率在合理范围内（1.0 - 3.0）

### 3. Mock 数据更新

**文件**: `app/llm/client.py`

为 mock DAG 生成添加 reward_multiplier：

**Deep 模式** (7 个节点):
- 节点 1（基础入门）: 1.0
- 节点 2-3（分支路径）: 1.2
- 节点 4-5（进阶路径）: 1.4
- 节点 6（知识汇合 quiz）: 2.0
- 节点 7（终极挑战 quiz）: 3.0 ⭐

**Fast/Light 模式** (5 个节点):
- 节点 1（基础入门）: 1.0
- 节点 2-3（分支路径）: 1.2
- 节点 4（知识汇合 quiz）: 2.0
- 节点 5（实战演练）: 2.5 ⭐

### 4. 数据模型更新

**文件**: `app/domain/models/course_map.py`

更新 `nodes` 字段的注释，包含 `reward_multiplier`。

### 5. 测试更新

**文件**: `tests/test_course_map.py`

- 更新测试用例中的 DAG 数据，添加 `reward_multiplier`
- 新增验证：检查所有节点都有 `reward_multiplier` 且值在 1.0-3.0 范围内

## 奖励计算示例

### 示例 1: 普通 learn 节点
- estimated_minutes: 20
- reward_multiplier: 1.0
- 结果: 200 金币, 100 经验

### 示例 2: Quiz 节点
- estimated_minutes: 20
- reward_multiplier: 2.0
- 结果: 400 金币, 200 经验

### 示例 3: 最终 Boss Quiz
- estimated_minutes: 20
- reward_multiplier: 3.0
- 结果: 600 金币, 300 经验 ⭐

## 迁移说明

### 现有数据兼容性

如果数据库中已有的 course_map 没有 `reward_multiplier` 字段：

1. **方案 A（推荐）**: 为缺失的字段提供默认值
   - 在读取节点时，如果没有 `reward_multiplier`，使用 1.5（quiz）或 1.0（learn）

2. **方案 B**: 数据迁移
   - 运行迁移脚本，为所有现有节点添加默认倍率

### 前端调整

前端在调用奖励相关 API 时，应从 DAG 节点数据中获取 `reward_multiplier` 并传递给后端。

## 验证

```bash
# 运行测试
cd /Users/lazyman/Desktop/evobook_be
uv run pytest tests/test_course_map.py -v

# 生成新的 course map 并检查 reward_multiplier
curl -X POST http://localhost:8000/api/v1/course-map/generate \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Python 编程",
    "level": "Beginner",
    "focus": "能独立写小程序",
    "verified_concept": "装饰器",
    "mode": "Fast",
    "total_commitment_minutes": 120
  }'
```

## 后续优化建议

1. **动态倍率调整**: 根据用户的学习表现，动态调整未来节点的奖励倍率
2. **倍率可视化**: 在前端展示节点的奖励倍率，让用户了解高价值节点
3. **成就系统**: 对于高倍率节点（>= 2.5），完成后授予特殊成就徽章
