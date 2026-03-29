# 维度五：移动端架构 — 评分 D

> 早期原型，无组件抽象、无样式系统、类型安全被 as any 架空

---

## 现状

| 指标 | 值 |
|------|-----|
| 源文件数（不含 node_modules） | 12 个 .ts/.tsx |
| 共享组件数 | 0 |
| 样式系统 | 无（全部行内 style） |
| 状态管理 | 无（zustand 安装未使用） |
| `as any` 使用次数 | 15+ 处 |
| 设计 token 定义 | 无（颜色/间距/圆角硬编码重复） |

---

## 文件清单与职责

```
app/
  _layout.tsx          # AuthProvider + tRPC Provider + Stack 导航 + 登录态重定向
  login.tsx            # 登录/注册表单
  onboarding.tsx       # 多轮 AI 对话式课程创建
  generating.tsx       # 调用 generate mutation + 跳转
  (tabs)/
    _layout.tsx        # Tab 布局（只有 1 个 tab）
    index.tsx          # 课程列表
  course/
    [id].tsx           # 知识树（DAG 节点展示 + 状态计算）
    card.tsx           # 知识卡片（Markdown 分页展示）
utils/
  auth.tsx             # AuthContext + Supabase auth
  constants.ts         # API URL + Supabase 凭证（硬编码）
  supabase.ts          # Supabase client 初始化
  trpc.ts              # tRPC React client
```

---

## 问题 1（P0）：类型安全完全失效

tRPC 的核心价值是端到端类型安全，但移动端用 `as any` 绕过了所有推断：

### 具体位置

**`(tabs)/index.tsx`**：
```typescript
const courses = (data as any)?.courses as CourseItem[] | undefined;  // L23
(item.mapMeta as any)?.course_name  // L41
```

**`course/[id].tsx`**（最严重，15+ 处 `as any`）：
```typescript
const items = (progressData as any).progress ?? progressData;  // L50
items.forEach((p: any) => { map[p.nodeId] = p.status; });  // L52
const nodes = (genData as any).nodesStatus ?? [];  // L62
nodes.forEach((n: any) => { map[n.nodeId ?? n.node_id] = n.status; });  // L63
const nodes = (courseData as any).nodes ?? [];  // L71
const grouped: Record<number, any[]> = {};  // L72
nodes.forEach((n: any) => { ... });  // L73
const allNodes = (courseData as any)?.nodes ?? [];  // L87
const mapMeta = (courseData as any)?.mapMeta;  // L139
const courseName = mapMeta?.course_name || (courseData as any)?.topic || '课程';  // L140
const allNodes = (courseData as any)?.nodes ?? [];  // L143
```

**`course/card.tsx`**：
```typescript
const currentNode = ((courseData as any)?.nodes ?? []).find((n: any) => n.id === nodeId);  // L32
const mapMeta = (courseData as any)?.mapMeta;  // L33
const result = await getCardMutation.mutateAsync({ ... });
const markdown = (result as any).markdown || '';  // L67
```

**`onboarding.tsx`**：
```typescript
setConcepts({ list: (response as any).concepts ?? [], selected: new Set() });  // L48
setFinishData((response as any).data);  // L50
catch (err: any)  // L52
```

### 根因分析

`as any` 不是开发者懒，而是 **tRPC 的返回类型推断在某些场景下不直观**。当 router 返回 `{ progress }` 时，客户端实际收到的类型是 `{ progress: NodeProgressItem[] }`，但开发者不确定字段名是什么，就用 `as any` 绕过。

### 修复方案

**Step 1**：在使用处直接利用 tRPC 的推断类型，不手动定义 interface：

```typescript
// ❌ 当前
interface CourseItem {
  courseMapId: string;
  topic: string;
  // ...手动定义，可能和后端不同步
}
const courses = (data as any)?.courses as CourseItem[] | undefined;

// ✅ 修复
const { data } = trpc.courseMap.list.useQuery();
// data 的类型已经被 tRPC 自动推断为 { courses: CourseListItem[] }
const courses = data?.courses;
```

**Step 2**：对于嵌套的 JSONB 字段（如 `nodes`、`mapMeta`），在后端 service 的返回类型中明确定义，而非返回 `unknown`：

```typescript
// 后端 course-map/service.ts 当前
export interface CourseMapDetail {
  mapMeta: unknown;  // ← 这导致客户端无法推断
  nodes: unknown;    // ← 同上
}

// 后端修复
export interface CourseMapDetail {
  mapMeta: MapMetaJson;
  nodes: DAGNodeJson[];
}
```

**Step 3**：移动端移除所有 `as any`，编译时就能发现类型不匹配。

---

## 问题 2（P0）：敏感信息硬编码

```typescript
// utils/constants.ts
export const API_BASE_URL = __DEV__
  ? 'http://10.0.0.193:8002'     // 开发者个人 IP
  : 'https://api.evobook.app';

export const SUPABASE_URL = 'https://slvwclfywvlpwfwlforw.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_YfPuZvwtREQO1tcTUXyEug_iLO9oLgK';
```

**问题**：
- 开发者 IP 硬编码，换电脑/换网络就得改代码
- Supabase 凭证直接提交到 Git
- 无法区分 staging / production 环境

**修复方案**：使用 Expo 的环境变量机制：

```typescript
// app.config.ts
export default {
  expo: {
    extra: {
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8002',
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  },
};
```

```typescript
// utils/constants.ts
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};
export const API_BASE_URL = extra.apiBaseUrl;
export const SUPABASE_URL = extra.supabaseUrl;
export const SUPABASE_ANON_KEY = extra.supabaseAnonKey;
```

配合 `.env` 文件（git ignore）管理不同环境。

---

## 问题 3（P1）：零组件抽象

所有 UI 直接写在路由页面文件中，没有 `components/` 目录。导致：

### 重复代码

**"← 返回" 按钮** 出现在 4 个页面中，每次都重新写：

```typescript
// course/[id].tsx
<TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
  <Text style={{ color: '#C7D2FE', fontSize: 15 }}>← 返回</Text>
</TouchableOpacity>

// course/card.tsx
<TouchableOpacity onPress={() => router.back()}>
  <Text style={{ color: '#4F46E5', fontSize: 16 }}>← 返回</Text>
</TouchableOpacity>

// onboarding.tsx
<TouchableOpacity onPress={() => router.back()}>
  <Text style={{ fontSize: 16, color: '#4F46E5' }}>← 返回</Text>
</TouchableOpacity>
```

颜色、字号、逻辑都不一致。

**加载状态** 在 3 个页面重复：

```typescript
<ActivityIndicator size="large" color="#4F46E5" />
```

### 建议的组件抽象层次

```
components/
  ui/
    Button.tsx           # 主按钮、次按钮、文字按钮
    BackButton.tsx       # 统一的返回按钮
    LoadingScreen.tsx    # 全屏加载状态
    ErrorScreen.tsx      # 全屏错误状态
    Badge.tsx            # 标签（level, mode 等）
    ProgressBar.tsx      # 进度条
  course/
    CourseCard.tsx       # 课程列表项
    NodeCard.tsx         # 知识树节点卡片
  chat/
    MessageBubble.tsx    # 对话气泡
    OptionButton.tsx     # 选项按钮
    ConceptPicker.tsx    # 概念多选器
```

---

## 问题 4（P1）：无样式系统

全部使用行内 `style={{ }}`，设计 token 重复硬编码：

### 颜色重复

| 颜色 | 含义 | 出现次数 |
|------|------|---------|
| `#4F46E5` | 主色/品牌紫 | 20+ 次 |
| `#F9FAFB` | 背景灰 | 5+ 次 |
| `#1F2937` | 文字深色 | 8+ 次 |
| `#6B7280` | 文字浅色 | 10+ 次 |
| `#E5E7EB` | 边框色 | 5+ 次 |
| `#EF4444` | 错误红 | 4 次 |

### 间距/圆角重复

- `borderRadius: 12` 出现 15+ 次
- `padding: 16` 出现 10+ 次
- `fontSize: 16` 出现 8+ 次

### 修复方案

**方案 A**（最小改动）：创建 `utils/theme.ts`：

```typescript
export const colors = {
  primary: '#4F46E5',
  primaryLight: '#EEF2FF',
  background: '#F9FAFB',
  surface: '#FFFFFF',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  error: '#EF4444',
  success: '#10B981',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: '800' as const },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 24 },
  caption: { fontSize: 12, color: '#9CA3AF' },
} as const;
```

**方案 B**（推荐，稍大改动）：引入 NativeWind（Tailwind for React Native），与 Web 端 Tailwind 保持一致的设计语言。

---

## 问题 5（P1）：导航参数传递大对象

```typescript
// onboarding.tsx L176
router.replace({
  pathname: '/generating',
  params: { data: JSON.stringify(finishData) }
});

// generating.tsx L22
const onboardingData = params.data ? JSON.parse(params.data) : null;
```

**问题**：
- `finishData` 可能包含大量字段（topic, level, focus, concepts 等），JSON 序列化后可能超出 URL 长度限制
- 路由参数在 Deep Link / 历史记录中暴露原始数据
- 解析失败没有错误处理

**修复方案**：

**方案 A**（推荐）：用 Zustand store 做 ephemeral state：

```typescript
// utils/stores/onboardingStore.ts
import { create } from 'zustand';

interface OnboardingStore {
  finishData: OnboardingFinishData | null;
  setFinishData: (data: OnboardingFinishData) => void;
  clear: () => void;
}

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  finishData: null,
  setFinishData: (data) => set({ finishData: data }),
  clear: () => set({ finishData: null }),
}));
```

```typescript
// onboarding.tsx
useOnboardingStore.getState().setFinishData(finishData);
router.replace('/generating');

// generating.tsx
const finishData = useOnboardingStore((s) => s.finishData);
```

这也解决了 zustand 作为死依赖的问题。

**方案 B**：用 React Context 做临时数据传递（适合不想引入 store 的场景）。

---

## 问题 6（P2）：useEffect 依赖和 React 规范

### generating.tsx

```typescript
useEffect(() => {
  if (hasStarted.current) return;
  hasStarted.current = true;
  // 使用了 params, generateMutation 但未列入依赖
}, []);
```

`useRef` + `hasStarted` 是 hack 式的"只执行一次"模式，且依赖数组不完整。

**修复**：如果用了 Zustand store 传数据（问题 5 的方案 A），可以简化为：

```typescript
useEffect(() => {
  const data = useOnboardingStore.getState().finishData;
  if (!data) return;
  generateCourse(data);
  return () => useOnboardingStore.getState().clear();
}, []);
```

### onboarding.tsx

```typescript
useEffect(() => {
  sendMessage({});  // sendMessage 依赖 sessionId 等状态
}, []);
```

同样的依赖遗漏。可以用 `useRef` 保存最新的函数引用，或使用 `useCallback` 正确管理。

---

## 问题 7（P2）：FlatList key 用索引

```typescript
// onboarding.tsx L116
keyExtractor={(_, i) => String(i)}
```

消息列表使用数组索引作为 key。当新消息插入时，React 可能复用错误的组件，导致：
- 消息内容闪烁
- 动画错乱
- 输入框状态串位

**修复**：给每条消息生成唯一 ID：

```typescript
interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
}

// 创建消息时
setMessages(prev => [...prev, {
  id: crypto.randomUUID(),
  role: 'assistant',
  content: response.message,
}]);

// FlatList
keyExtractor={(item) => item.id}
```

---

## 问题 8（P2）：AuthContext 默认值不安全

```typescript
// utils/auth.tsx L14
const AuthContext = createContext<AuthContextType>({} as AuthContextType);
```

如果在 `AuthProvider` 外部调用 `useAuth()`，会得到空对象 `{}`，`user` 等字段都是 `undefined`，运行时静默失败。

**修复**：

```typescript
const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

---

## 问题 9（P2）：空 catch 吞错误

```typescript
// _layout.tsx L73
} catch {}
```

tRPC header 获取 session 失败时静默吞掉。如果 Supabase token 过期或 SecureStore 读取失败，请求以匿名身份发出，用户看到的是莫名其妙的 "未登录" 错误。

**修复**：

```typescript
} catch (err) {
  console.warn('[trpc] Failed to get auth session:', err);
}
```

---

## 问题 10（P3）：死依赖和多余依赖

| 依赖 | 状态 | 建议 |
|------|------|------|
| `zustand` | 安装但未使用 | 用起来（问题 5）或移除 |
| `@trpc/server` | 移动端不需要 server 包 | 移除（类型通过 tsconfig paths 解析） |
| `useWindowDimensions` 的 `width` | card.tsx 中导入但未使用 | 移除 |

---

## 改造路线图

### Phase 1（基础修复，1-2 天）

- [ ] 修复所有 `as any`（通过后端返回类型 + tRPC 推断）
- [ ] 创建 `utils/theme.ts` 设计 token
- [ ] 修复 `constants.ts` 使用 Expo 环境变量
- [ ] 修复空 catch、AuthContext 默认值
- [ ] 修复 FlatList keyExtractor

### Phase 2（组件抽象，2-3 天）

- [ ] 创建 `components/ui/` 基础组件（Button, BackButton, LoadingScreen, ErrorScreen, ProgressBar）
- [ ] 重构各页面使用基础组件
- [ ] 创建 `components/course/` 业务组件（CourseCard, NodeCard）
- [ ] 用 Zustand store 替代路由参数传大对象

### Phase 3（架构完善，3-5 天）

- [ ] 引入 StyleSheet.create 或 NativeWind
- [ ] 建立 hooks 层（`useCourseMaps`, `useKnowledgeTree`, `useOnboarding`）
- [ ] DAG 状态计算逻辑提取到 `packages/shared`（与 Web 端共享）
- [ ] 错误边界组件（ErrorBoundary）
- [ ] 离线缓存策略（TanStack Query persistence）

### Phase 4（体验优化）

- [ ] 骨架屏（Skeleton）替代 ActivityIndicator
- [ ] 页面切换动画
- [ ] Tab 扩展（发现、个人中心）
- [ ] 下拉刷新

---

## 目标架构

```
app/                          # Expo Router 文件系统路由
  _layout.tsx                 # Providers
  login.tsx
  onboarding.tsx
  generating.tsx
  (tabs)/
    _layout.tsx
    index.tsx                 # 课程列表
    discover.tsx              # 发现
    profile.tsx               # 个人中心
  course/
    [id].tsx                  # 知识树
    card.tsx                  # 知识卡片

components/                   # 可复用组件
  ui/                         # 基础 UI 组件
    Button.tsx
    BackButton.tsx
    LoadingScreen.tsx
    ErrorScreen.tsx
    ProgressBar.tsx
    Badge.tsx
  course/                     # 业务组件
    CourseCard.tsx
    NodeCard.tsx
  chat/                       # 对话组件
    MessageBubble.tsx
    OptionButton.tsx

hooks/                        # 自定义 hooks
  useCourseMaps.ts            # 课程列表数据 + 操作
  useKnowledgeTree.ts         # 知识树 DAG 状态计算
  useOnboarding.ts            # onboarding 对话流程

utils/
  theme.ts                    # 设计 token
  constants.ts                # 环境变量
  trpc.ts                     # tRPC client
  auth.tsx                    # Auth context
  supabase.ts                 # Supabase client
  stores/
    onboardingStore.ts        # 临时数据传递

shared/                       # 或 packages/shared
  dag-utils.ts                # DAG 状态计算（与 Web 共享）
```
