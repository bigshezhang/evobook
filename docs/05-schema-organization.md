# 数据库 Schema 组织策略

## 现状分析

所有表定义集中在 `src/db/schema.ts` 一个文件中：

- **16 张表**：profiles, onboardingSessions, courseMaps, nodeContents, nodeProgress, quizAttempts, gameTransactions, learningActivities, shopItems, userInventory, userStats, discoveryCourses, promptRuns, userInvites, inviteBindings, userRewards
- **9 个 pgEnum**
- **13 个 relations 定义**
- **6+ 个 JSON 类型接口**（MapMetaJson, DAGNodeJson, OnboardingStateJson, SeedContextJson, QuizQuestionJson, QuizJson）

文件约 500+ 行，且随着业务增长还会持续膨胀。

---

## 与 VSA 的关系

在严格的 VSA 中，每个切片应该拥有自己的数据模型。但在使用 Drizzle ORM + 单一 PostgreSQL 的场景下：

1. Drizzle 的 migration 系统需要在同一个 `drizzle.config.ts` 中指定 schema 路径
2. `relations()` 定义需要引用跨表的 schema
3. 数据库本质上是共享的——"每个切片拥有自己的表"只是逻辑层面的约定

因此建议采用**按领域分组**而非完全拆散的方案。

---

## 建议方案：按领域分组

### 目标目录结构

```
src/db/
  index.ts                   # db 客户端（不变）
  schema/
    index.ts                 # 重新导出所有表和 relations（保持向后兼容）
    enums.ts                 # 所有 pgEnum 集中定义
    types.ts                 # JSON 类型接口（MapMetaJson, DAGNodeJson 等）
    learning.ts              # courseMaps, nodeContents, nodeProgress 表
    user.ts                  # profiles, userStats, learningActivities 表
    onboarding.ts            # onboardingSessions 表
    quiz.ts                  # quizAttempts 表
    game.ts                  # gameTransactions, shopItems, userInventory 表
    discovery.ts             # discoveryCourses 表
    social.ts                # userInvites, inviteBindings, userRewards 表
    observability.ts         # promptRuns 表
    relations.ts             # 所有 relations（集中定义，因为跨表引用不可避免）
```

### schema/index.ts 示例

```typescript
// 重新导出，外部 import 路径不变
export * from './enums';
export * from './types';
export * from './learning';
export * from './user';
export * from './onboarding';
export * from './quiz';
export * from './game';
export * from './discovery';
export * from './social';
export * from './observability';
export * from './relations';
```

### 分组逻辑

| 分组 | 表 | 对应的 feature 切片 |
|------|-----|---------------------|
| **learning** | courseMaps, nodeContents, nodeProgress | course-map, node-content, node-progress |
| **user** | profiles, userStats, learningActivities | profile, learning-session |
| **onboarding** | onboardingSessions | onboarding |
| **quiz** | quizAttempts | quiz |
| **game** | gameTransactions, shopItems, userInventory | game, shop, inventory |
| **discovery** | discoveryCourses | discovery |
| **social** | userInvites, inviteBindings, userRewards | invite |
| **observability** | promptRuns | lib/llm (基础设施) |

### relations.ts 为何保持集中

Drizzle 的 `relations()` 需要引用多张表的 schema 对象。例如：

```typescript
export const courseMapsRelations = relations(courseMaps, ({ one, many }) => ({
  user: one(profiles, { fields: [courseMaps.userId], references: [profiles.id] }),
  nodeProgressEntries: many(nodeProgress),
}));
```

`courseMapsRelations` 同时引用了 `courseMaps`（learning 分组）、`profiles`（user 分组）、`nodeProgress`（learning 分组）。拆散 relations 到各自分组文件中会导致循环 import。集中在一个 `relations.ts` 里是最务实的做法。

---

## 迁移步骤

### Step 1: 创建目录结构

```bash
mkdir -p src/db/schema
```

### Step 2: 提取 enums 和 types

将 `pgEnum` 定义和 JSON 类型接口分别移到 `enums.ts` 和 `types.ts`。

### Step 3: 按分组拆表

将 `pgTable` 定义移到对应的分组文件中。每个文件只 import 自己需要的 enum 和 type。

### Step 4: 移动 relations

将所有 `relations()` 定义移到 `relations.ts`，import 所有需要的表。

### Step 5: 创建 barrel export

`schema/index.ts` 重新导出所有内容。修改 `db/index.ts` 的 import 路径：

```typescript
// db/index.ts
import * as schema from './schema';
export const db = drizzle(client, { schema });
```

### Step 6: 全局搜索替换

```
from '../../db/schema'  →  不需要改（barrel export 保持了路径兼容）
```

**关键**：由于 `schema/index.ts` 重新导出了一切，所有 feature 中的 `import { ... } from '../../db/schema'` **无需修改**。

### Step 7: 更新 drizzle.config.ts

```typescript
export default defineConfig({
  schema: './src/db/schema/*.ts',  // 改为 glob 匹配
  // ...
});
```

---

## 额外建议：JSON 类型强化

当前 JSON 类型接口（如 `MapMetaJson`、`DAGNodeJson`）定义在 schema 中，但很多地方使用时仍然用 `as any` 或 `as Record<string, unknown>`。

建议：

1. 将 JSON 类型定义从 `schema` 移到 `types.ts`
2. 在 service 层严格使用这些类型，不再用 `as any`
3. 考虑为 JSONB 列定义 Zod schema，在写入时也做校验

```typescript
// src/db/schema/types.ts
import { z } from 'zod';

export const dagNodeSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  type: z.enum(['learn', 'quiz']),
  layer: z.number(),
  pre_requisites: z.array(z.number()),
  estimated_minutes: z.number(),
});

export type DAGNodeJson = z.infer<typeof dagNodeSchema>;
```

---

## 优先级

| 优先级 | 改动 | 工作量 | 风险 |
|--------|------|--------|------|
| P1 | 按领域分组拆文件 | 中 | 低（barrel export 保证兼容） |
| P1 | enums 和 types 单独提取 | 小 | 极低 |
| P2 | JSON 类型强化（Zod schema） | 中 | 低 |
| P3 | relations 集中管理 | 小 | 低 |
