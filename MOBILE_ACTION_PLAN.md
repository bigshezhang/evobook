# EvoBook Mobile 行动指南

> 目标：在现有 TypeScript 全栈 monorepo 基础上，新增 Expo/React Native 移动端，实现 iOS + Android 跨平台。

---

## 一、当前架构现状

```
evobook/
├── apps/
│   ├── web/           React 19 + Vite + tRPC Client（PC 端，已完成）
│   └── api/           Hono + tRPC + Drizzle + Gemini（后端，已完成）
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

**已就位的基础设施：**
- tRPC 端到端类型安全 API（13 个 feature slices）
- Supabase Auth（JWT，前后端共享）
- PostgreSQL + Drizzle ORM
- Gemini LLM 集成（知识卡片、onboarding、quiz 生成）
- pnpm workspace monorepo

---

## 二、目标架构

```
evobook/
├── apps/
│   ├── web/           PC 端（不变）
│   ├── api/           后端（不变）
│   └── mobile/        NEW: Expo/React Native
│       ├── app/       Expo Router 页面
│       ├── components/ RN 组件
│       ├── utils/
│       │   ├── trpc/  tRPC client（复用 AppRouter 类型）
│       │   └── stores/ Zustand stores（从 web 移植）
│       └── app.json
├── packages/
│   └── shared-stores/ OPTIONAL: 跨端共享 Zustand stores
└── ...
```

---

## 三、执行阶段

### Phase 1: Expo 项目初始化（1 天）

**做什么：**
1. `npx create-expo-app apps/mobile --template blank-typescript`
2. 配置 Expo Router（文件路由）
3. 安装 `@trpc/client`、`@trpc/react-query`、`@tanstack/react-query`
4. 安装 `@supabase/supabase-js`（移动端 auth）
5. 安装 `zustand`（状态管理）
6. 创建 tRPC client，import `AppRouter` type from `@evobook/api`
7. 验证 `trpc.health.check.useQuery()` 在模拟器中跑通

**Good Case：**
- 模拟器中能看到 health check 返回 `{ ok: true }`
- tRPC 类型推导在 mobile 端完全生效
- Expo dev server 正常启动，无依赖冲突

**Bad Case：**
- ❌ 在 mobile 中直接 import web 端的 React 组件（RN 不支持 HTML 标签）
- ❌ 把 `@evobook/api` 作为 runtime dependency（只需要 type import）
- ❌ 用 `localStorage`（RN 中不存在，用 `expo-secure-store` 或 `@react-native-async-storage/async-storage`）

### Phase 2: Auth 流程（2 天）

**做什么：**
1. Supabase Auth 集成（邮箱/OAuth 登录）
2. Session 持久化（`expo-secure-store` 存 refresh token）
3. Auth guard 保护需要登录的页面
4. tRPC client 自动注入 Bearer token

**Good Case：**
- 登录后 token 持久化，杀进程重开不需要重新登录
- tRPC protectedProcedure 调用正常返回数据
- 登出后 token 清除，重定向到登录页

**Bad Case：**
- ❌ 用 `AsyncStorage` 存 access token（不安全，用 `expo-secure-store`）
- ❌ 在每个组件中手动传 token（应在 tRPC httpBatchLink 的 headers 中统一注入）
- ❌ 不处理 token 过期刷新（Supabase SDK 自动处理，但需要正确配置 `autoRefreshToken`）

### Phase 3: 核心页面（5-7 天）

按用户旅程优先级逐页实现：

| 优先级 | 页面 | tRPC 调用 | 复杂度 |
|--------|------|-----------|--------|
| P0 | 登录/注册 | Supabase Auth | 低 |
| P0 | 课程列表（首页） | `courseMap.list` | 中 |
| P0 | 知识树 | `courseMap.getDetail` + `nodeProgress.get` | 高 |
| P0 | 知识卡片 | `nodeContent.getKnowledgeCard` | 高 |
| P1 | Onboarding | `onboarding.next`（多轮对话） | 高 |
| P1 | Quiz | `quiz.generate` + `quiz.submit` | 中 |
| P2 | 个人中心 | `profile.get` + `profile.getStats` | 低 |
| P2 | 发现页 | `discovery.listCourses` + `discovery.joinCourse` | 低 |
| P3 | 游戏（旅行棋盘） | `game.*` | 高 |
| P3 | 商店/背包 | `shop.*` + `inventory.*` | 中 |

**Good Case：**
- 每个页面独立可测试，不依赖其他页面完成
- 复用 tRPC 类型，零手写 interface
- RN 原生手势和动画（知识树拖拽、卡片翻页）
- Markdown 渲染用 `react-native-markdown-display`

**Bad Case：**
- ❌ 一次性实现所有页面（应按 P0 → P1 → P2 → P3 逐步推进）
- ❌ 直接移植 web 端的 HTML/CSS（必须用 RN 组件重写 UI）
- ❌ 在 mobile 中使用 Mermaid 图表（浏览器 Only，用 RN Canvas 或简化展示）
- ❌ 在 mobile 中使用 html2canvas / html-to-image（Web Only）

### Phase 4: 原生能力（2-3 天）

| 能力 | 方案 | 优先级 |
|------|------|--------|
| 推送通知 | `expo-notifications` + APNs/FCM | P1 |
| 生物识别 | `expo-local-authentication` | P2 |
| 离线支持 | `@tanstack/react-query` 持久化缓存 | P2 |
| 分享 | `expo-sharing` | P3 |
| Haptic 反馈 | `expo-haptics` | P3 |

**Good Case：**
- 推送通知走 Expo Push Service，后端只存 device token
- 离线时显示缓存数据，在线后自动同步

**Bad Case：**
- ❌ 自建推送服务器（用 Expo Push Service 或 FCM）
- ❌ 每个原生能力都自己写 native module（用 Expo 生态的现成包）

### Phase 5: 发布（1-2 天）

1. `eas build --platform ios` + `eas build --platform android`
2. App Store Connect 上传 + TestFlight 测试
3. Google Play Console 上传 + 内测轨道

---

## 四、技术决策记录

### 为什么 Expo 而不是 Capacitor？

| | Expo/RN | Capacitor |
|---|---------|-----------|
| UI 体验 | 原生组件，60fps | WebView 包壳，有明显 Web 感 |
| 生态 | 最大的移动端 JS 生态 | 相对小众 |
| 代码复用 | stores + tRPC types 共享，UI 重写 | HTML/CSS 直接复用，但体验差 |
| AI 代码生成 | 训练数据丰富，AI 熟悉度高 | 较少训练数据 |
| 长期维护 | Meta 主导，稳定 | Ionic 团队，规模较小 |

### 为什么不用 Expo Web（一套代码三端）？

- EvoBook 的 web 端用了 Mermaid、html2canvas、Tailwind CSS，这些在 RN 中不可用
- RN 的 Flexbox 和 Web CSS 有细微差异，强行统一会两端都不好
- 分开维护 UI 层，共享数据层（tRPC + stores），是业界主流做法

### 字段命名约定

- Drizzle 列名 → **camelCase**（`courseMapId`、`nodeId`）
- JSONB 内容 → **snake_case**（`course_name`、`pre_requisites`）
- tRPC input → **camelCase**（`courseMapId`、`verifiedConcept`）
- tRPC output → **camelCase**（Drizzle 列名）+ JSONB 内容保持 **snake_case**

---

## 五、不做什么（收敛清单）

1. **不重写后端** — API 已经是 TypeScript + tRPC，mobile 端直接调用
2. **不做 Web 端响应式适配** — Web 和 Mobile 各自独立，不共享 UI 组件
3. **不自建推送基础设施** — 用 Expo Push Service
4. **不做离线优先架构** — 先做在线体验，离线缓存作为增强
5. **不同时开发所有页面** — 按 P0 → P3 严格排期
6. **不引入新的状态管理** — 继续用 Zustand，不引入 Redux/MobX
7. **不做跨端 UI 组件库** — Web 用 Tailwind，Mobile 用 NativeWind 或 StyleSheet，不强行统一

---

## 六、里程碑与验收标准

| 里程碑 | 验收标准 | 预估时间 |
|--------|---------|---------|
| M1: 骨架 | 模拟器中 health check 通过 | 1 天 |
| M2: Auth | 登录 → 看到课程列表 | 2 天 |
| M3: 学习核心 | 知识树 → 知识卡片 → 完成节点 | 5 天 |
| M4: 完整流程 | Onboarding → 生成课程 → 学习 → Quiz | 3 天 |
| M5: 发布 | TestFlight + Google Play 内测 | 2 天 |

**总计：约 13 天（2-3 周）**
