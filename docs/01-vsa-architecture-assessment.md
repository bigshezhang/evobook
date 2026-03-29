# Vertical Slice Architecture 评估报告

## 参考标准

基于 [Jimmy Bogard 的 Vertical Slice Architecture](https://www.jimmybogard.com/vertical-slice-architecture/) 核心原则：

1. **围绕独立请求/用例组织代码**，而非围绕技术层
2. **切片间耦合最小化，切片内耦合最大化**
3. **每个切片自行决定如何处理请求**（Transaction Script / Domain Model / 其它）
4. **添加新功能 = 添加新代码**，不修改共享代码
5. **不强制要求共享抽象**（如 Repository、Service 接口）

---

## 当前架构与 VSA 的对照

### ✅ 已良好实现的部分

#### 1. Feature-Sliced 目录结构

```
src/features/
  ├── course-map/     # router.ts + service.ts
  ├── discovery/      # router.ts + service.ts
  ├── game/           # router.ts + service.ts
  ├── health/         # router.ts (无 service)
  ├── inventory/      # router.ts + service.ts
  ├── invite/         # router.ts + service.ts
  ├── learning-session/ # router.ts + service.ts
  ├── node-content/   # router.ts + service.ts
  ├── node-progress/  # router.ts + service.ts
  ├── onboarding/     # router.ts + service.ts
  ├── profile/        # router.ts + service.ts
  ├── quiz/           # router.ts + service.ts
  └── shop/           # router.ts + service.ts
```

**评价**：✅ 完全符合 VSA，每个业务域是一个独立切片。

#### 2. 零跨切片 import

经过逐文件审查，**没有任何** `features/A` 导入 `features/B` 的代码。所有切片只依赖共享基础设施（`db/`、`lib/`、`trpc.ts`），彼此完全独立。

**评价**：✅ 这是 VSA 最核心的要求——切片间耦合为零。

#### 3. 无强制抽象层

没有 Repository 接口、没有 BaseService 基类、没有强制的中间层。每个 service 按自己的需求直接操作 DB。

**评价**：✅ 符合 VSA 的"抽象按需产生"原则。

#### 4. 瘦 Router 模式

Router 只负责：输入校验（Zod）→ 调用 service → 错误映射。
不包含业务逻辑。

**评价**：✅ 良好的关注点分离。

### ⚠️ 部分偏离的地方

#### 5. 单一巨型 Schema 文件

`db/schema.ts` 包含 **所有** 16+ 张表、9 个 enum、13 个 relations、6+ 个 JSON 类型——大约 500+ 行。所有切片共享同一个 schema 文件。

**与 VSA 的偏离**：VSA 提倡每个切片拥有自己的数据关注点。当前 schema 是一个"水平层"，修改任何表结构都需要在这个共享文件中操作。

**但需要注意**：由于使用 Drizzle ORM + 单一 PostgreSQL 数据库，schema 完全拆散到每个 feature 里在迁移管理上反而更复杂。这是一个现实权衡。

**建议**：参见 [05-schema-organization.md](./05-schema-organization.md)

#### 6. 跨切片的隐式数据耦合

虽然没有 import 级别的耦合，但存在**多个切片操作同一张表**的情况：

| 表 | 操作它的切片 |
|----|-------------|
| `profiles` | profile、discovery、course-map、onboarding、game、inventory、learning-session、invite |
| `node_progress` | node-progress、discovery、course-map |
| `node_contents` | node-content、course-map、discovery |
| `game_transactions` | game、shop |

**与 VSA 的偏离**：在更严格的 VSA 中，每个切片应该拥有自己的数据投影。当前的设计让 `profiles` 表成为了一个"上帝表"，几乎所有切片都在读写它。

**建议**：参见 [06-feature-slice-patterns.md](./06-feature-slice-patterns.md)

#### 7. 共享基础设施层的边界不清

`lib/` 目录下的共享代码本身没问题（VSA 允许共享基础设施），但当前存在一些边界模糊的地方：

- `lib/llm.ts` 既是基础设施（HTTP 调用、重试），又包含业务性的 Mock 数据
- `trpc.ts` 的 `createContext` 执行了业务操作（`ensureProfileExists`）

**建议**：参见 [03-llm-layer-reform.md](./03-llm-layer-reform.md) 和 [04-context-auth-optimization.md](./04-context-auth-optimization.md)

### ❌ 明显缺失的部分

#### 8. 切片内没有"按请求裁剪"

VSA 的核心理念是：**每个请求可以自行决定复杂度**。简单的 CRUD 用 Transaction Script，复杂的用 Domain Model。

当前所有切片都采用统一的 `router → service(db, ...)` 模式，无论请求复杂度如何。这不是问题，但在 `course-map/service.ts`（533 行，包含 LLM 编排、后台任务、进度聚合）这种复杂切片中，应该考虑进一步拆分 handler。

#### 9. 错误处理没有统一的切片内策略

VSA 允许每个切片自决，但错误处理应该有一致的"切片-基础设施"契约。当前 4 种不同的错误模式（`TRPCError` / `Error` + message 匹配 / 结果对象 / 静默吞掉）导致维护心智负担过重。

**建议**：参见 [02-error-handling-reform.md](./02-error-handling-reform.md)

---

## 总体评价

| 维度 | 评分 | 说明 |
|------|------|------|
| 切片独立性 | **A** | 零跨切片 import，堪称典范 |
| 目录组织 | **A** | Feature-sliced 结构清晰一致 |
| 无强制抽象 | **A** | 没有过度工程化 |
| 数据边界 | **C+** | profiles 表成为隐式耦合点 |
| 切片内裁剪 | **B-** | 所有切片采用相同模式，复杂切片缺少拆分 |
| 基础设施契约 | **C** | 错误处理不一致，Context 边界模糊 |

**结论**：当前架构**已经是 VSA 的良好基础**，切片独立性做得很好。主要改进方向不是推倒重来，而是：

1. 统一切片与基础设施之间的**错误处理契约**
2. 将过大的 Schema 做适度**按领域分组**
3. 改善 `lib/` 层的**职责边界**
4. 对复杂切片（course-map、onboarding）做**切片内拆分**
