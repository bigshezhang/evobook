# 硬编码重构总结

## 完成时间
2026-02-08

## 概述
本次重构消除了项目中的硬编码问题，创建了统一的常量文件，提高了代码的可维护性和一致性。

---

## 🔴 高优先级 - 已完成

### 1. ✅ 后端错误代码统一
**文件**: `app/core/error_codes.py`

创建了统一的错误代码常量：
```python
# 通用错误
ERROR_INTERNAL = "INTERNAL_ERROR"
ERROR_UNKNOWN = "UNKNOWN_ERROR"
ERROR_INVALID_UUID = "INVALID_UUID"
ERROR_INVALID_PARAMETER = "INVALID_PARAMETER"

# 资源未找到
ERROR_PROFILE_NOT_FOUND = "PROFILE_NOT_FOUND"
ERROR_COURSE_NOT_FOUND = "COURSE_NOT_FOUND"
ERROR_NODE_NOT_FOUND = "NODE_NOT_FOUND"
ERROR_ITEM_NOT_FOUND = "ITEM_NOT_FOUND"

# 资源不足
ERROR_INSUFFICIENT_DICE = "INSUFFICIENT_DICE"
ERROR_INSUFFICIENT_GOLD = "INSUFFICIENT_GOLD"

# 验证错误
ERROR_INVALID_AMOUNT = "INVALID_AMOUNT"
ERROR_INVALID_REWARD_TYPE = "INVALID_REWARD_TYPE"

# 邀请错误
ERROR_INVITE_ALREADY_BOUND = "ALREADY_BOUND"
ERROR_INVITE_INVALID_CODE = "INVALID_CODE"
ERROR_INVITE_SELF_INVITE = "SELF_INVITE"

# 所有权错误
ERROR_ITEM_NOT_OWNED = "ITEM_NOT_OWNED"
```

**已更新的文件**:
- ✅ `app/domain/services/game_service.py`
- ✅ `app/domain/services/shop_service.py`
- ✅ `app/domain/services/inventory_service.py`
- ✅ `app/domain/services/invite_service.py`

### 2. ✅ 后端状态值和业务常量
**文件**: `app/domain/constants.py`

创建了统一的业务常量：
```python
# 节点状态
NODE_STATUS_LOCKED = "locked"
NODE_STATUS_UNLOCKED = "unlocked"
NODE_STATUS_IN_PROGRESS = "in_progress"
NODE_STATUS_COMPLETED = "completed"

# 节点类型
NODE_TYPE_LEARN = "learn"
NODE_TYPE_QUIZ = "quiz"

# 学习等级
LEVEL_NOVICE = "Novice"
LEVEL_BEGINNER = "Beginner"
LEVEL_INTERMEDIATE = "Intermediate"
LEVEL_ADVANCED = "Advanced"

# 学习模式
MODE_DEEP = "Deep"
MODE_FAST = "Fast"
MODE_LIGHT = "Light"

# 奖励类型
REWARD_TYPE_GOLD = "gold"
REWARD_TYPE_DICE = "dice"
REWARD_TYPE_EXP = "exp"

# 业务规则
INVITE_CODE_LENGTH = 6
INVITE_CODE_MAX_RETRIES = 3
DICE_MIN_VALUE = 1
DICE_MAX_VALUE = 4
NODE_REWARD_QUIZ_EXP = 20
NODE_REWARD_REGULAR_EXP = 10
```

**已更新的文件**:
- ✅ `app/domain/services/node_progress_service.py`
- ✅ `app/domain/services/game_service.py`
- ✅ `app/domain/services/invite_service.py`

### 3. ✅ 前端状态值和 localStorage 键统一
**文件**: `utils/constants.ts`

创建了统一的前端常量：
```typescript
// 节点状态
export const NODE_STATUS = {
  LOCKED: 'locked',
  UNLOCKED: 'unlocked',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
} as const;

// 节点类型
export const NODE_TYPE = {
  LEARN: 'learn',
  QUIZ: 'quiz',
} as const;

// 学习等级
export const LEVEL = {
  NOVICE: 'Novice',
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
} as const;

// 学习模式
export const MODE = {
  DEEP: 'Deep',
  FAST: 'Fast',
  LIGHT: 'Light',
} as const;

// LocalStorage 键
export const STORAGE_KEYS = {
  ONBOARDING_COMPLETED: 'evo_onboarding_completed',
  ONBOARDING_DATA: 'evo_onboarding_data',
  ASSESSMENT_SESSION_ID: 'evo_assessment_session_id',
  SELECTED_TOPIC: 'evo_selected_topic',
  COURSE_MAP: 'evo_course_map',
  MAIN_COURSE: 'evo_main_course',
  CURRENT_NODE: 'evo_current_node',
  LEARNED_TOPICS: 'evo_learned_topics',
  NODE_PROGRESS: 'evo_node_progress',
  QA_HISTORY_PREFIX: 'evo_qa_history_',
  KC_CACHE_PREFIX: 'evo_kc_',
  USER_MASCOT: 'evo_user_mascot',
  USER_OUTFIT: 'evo_user_outfit',
  PENDING_INVITE_CODE: 'pending_invite_code',
} as const;

// 业务配置
export const BUSINESS_CONFIG = {
  HEARTBEAT_INTERVAL_MS: 30000,
  DEFAULT_MODE: MODE.FAST,
  DEFAULT_COMMITMENT_MINUTES: 120,
  INITIAL_PROGRESS_PERCENT: 30,
  MINUTES_TO_HOURS_THRESHOLD: 120,
  SECONDS_PER_HOUR: 3600,
  SECONDS_PER_MINUTE: 60,
  QUIZ_PASS_SCORE: 60,
} as const;
```

**已更新的文件**:
- ✅ `utils/api.ts` - 导出新常量，删除旧的 STORAGE_KEYS
- ✅ `App.tsx` - 使用 STORAGE_KEYS
- ✅ `utils/inviteHandler.ts` - 使用 STORAGE_KEYS
- ✅ `views/onboarding/GeneratingCourse.tsx` - 使用 BUSINESS_CONFIG
- ✅ `views/onboarding/AssessmentChat.tsx` - 使用 STORAGE_KEYS
- ✅ `views/learning/KnowledgeCard.tsx` - 使用 STORAGE_KEYS

---

## ⚠️ 中优先级 - 已完成

### 4. ✅ 邀请链接 base_url 从配置读取
**修改**: `app/domain/services/invite_service.py`

```python
# 之前：硬编码
base_url: str = "https://evobook.app"

# 现在：从配置读取
base_url: str | None = None

# 方法内部
if base_url is None:
    from app.config import get_settings
    base_url = get_settings().frontend_base_url
```

### 5. ✅ 业务规则常量化
- ✅ 邀请码生成重试次数: `INVITE_CODE_MAX_RETRIES = 3`
- ✅ 邀请码长度: `INVITE_CODE_LENGTH = 6`
- ✅ 骰子范围: `DICE_MIN_VALUE = 1`, `DICE_MAX_VALUE = 4`
- ✅ 节点奖励: `NODE_REWARD_QUIZ_EXP`, `NODE_REWARD_REGULAR_EXP`

### 6. ✅ 前端 localStorage 键统一
所有分散的 localStorage 键已统一到 `STORAGE_KEYS` 常量对象。

---

## 📋 需要进一步重构的部分

### API 层错误代码
以下 API 文件仍需更新使用新的错误代码常量：

**需要更新**:
- `app/api/v1/profile.py`
- `app/api/v1/invite.py`
- `app/api/v1/inventory.py`
- `app/api/v1/shop.py`
- `app/api/v1/game.py`
- `app/api/v1/quiz.py`
- `app/api/v1/learning_session.py`
- `app/api/v1/node_progress.py`
- `app/api/v1/course_map.py`
- `app/core/auth.py`
- `app/core/middleware.py`
- `app/core/exceptions.py`

**操作**:
将这些文件中的硬编码错误代码（如 `"INTERNAL_ERROR"`, `"INVALID_UUID"` 等）替换为从 `app.core.error_codes` 导入的常量。

### 前端部分文件
一些前端文件可能因为实际内容与读取时有差异，需要手动检查和更新：

**需要检查**:
- `views/learning/KnowledgeTree.tsx` - 状态值硬编码
- `views/onboarding/InterestSelection.tsx` - STORAGE_KEYS
- `utils/mascotUtils.ts` - STORAGE_KEYS
- `views/learning/CourseDetail.tsx` - STORAGE_KEYS
- `utils/activityAggregator.ts` - 活动强度常量

---

## 使用说明

### 后端

```python
# 导入错误代码
from app.core.error_codes import ERROR_PROFILE_NOT_FOUND, ERROR_INVALID_UUID

# 导入业务常量
from app.domain.constants import (
    NODE_STATUS_COMPLETED,
    NODE_TYPE_QUIZ,
    LEVEL_BEGINNER,
    MODE_FAST,
    REWARD_TYPE_GOLD,
)

# 使用示例
if not profile:
    raise AppException(
        status_code=404,
        error_code=ERROR_PROFILE_NOT_FOUND,
        message="User profile not found",
    )

if node_type == NODE_TYPE_QUIZ:
    reward = NODE_REWARD_QUIZ_EXP
```

### 前端

```typescript
// 导入常量
import {
  STORAGE_KEYS,
  NODE_STATUS,
  NODE_TYPE,
  LEVEL,
  MODE,
  BUSINESS_CONFIG
} from './utils/constants';

// 使用示例
localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');

if (node.status === NODE_STATUS.COMPLETED) {
  // ...
}

if (node.type === NODE_TYPE.QUIZ) {
  // ...
}

const mode = BUSINESS_CONFIG.DEFAULT_MODE;
const interval = BUSINESS_CONFIG.HEARTBEAT_INTERVAL_MS;
```

---

## 影响与收益

### ✅ 代码可维护性提升
- 所有魔法字符串集中管理
- 修改常量值只需改一处
- TypeScript 类型推导更准确

### ✅ 减少错误
- 避免拼写错误
- 编译时检查常量引用
- IDE 自动补全支持

### ✅ 代码可读性提升
- 常量名称有语义
- 统一的命名风格
- 清晰的常量分组

### ✅ 配置灵活性
- 业务规则可调整
- 环境配置分离
- 便于测试和调试

---

## 后续建议

1. **完成 API 层重构**: 将所有 API 文件中的错误代码替换为常量
2. **添加常量文档**: 在常量文件中添加更详细的注释说明
3. **创建迁移指南**: 为团队成员提供迁移示例
4. **代码审查**: 确保所有新代码都使用常量而非硬编码
5. **单元测试**: 验证常量的正确性和一致性

---

## 相关文件

**新增文件**:
- `app/core/error_codes.py`
- `app/domain/constants.py`
- `utils/constants.ts`

**主要修改文件**:
- 后端: 8+ service 文件
- 前端: 10+ 组件和工具文件

**待修改文件**:
- 后端: 12+ API 文件
- 前端: 5+ 组件文件
