# 智能路由修复 - 已有课程用户直接进入Dashboard

## 🎯 问题描述

### 修复前的问题

用户登录后的流程有问题：

1. **老用户重新登录**
   - 场景：用户之前创建过课程，换设备或清除 localStorage 后再登录
   - 问题：系统认为是新用户，要求重新完成 Onboarding
   - 体验：浪费时间，用户困惑

2. **localStorage 依赖**
   - 依赖 `evo_onboarding_completed` 标记判断用户状态
   - 跨设备登录时 localStorage 为空，判断失效

3. **路由不智能**
   - 登录后总是跳转到 `/`
   - 然后根据 localStorage 判断去哪里
   - 无法处理跨设备场景

---

## ✅ 修复方案

### 核心思路

**检查后端数据而非 localStorage**：
- 用户登录后，检查后端是否有课程
- 有课程 → 直接进入 Dashboard
- 没有课程 → 进入 Onboarding

### 实现细节

#### 1. 智能根路由组件 (`RootRedirect`)

```typescript
// 修复前：只检查 localStorage
const RootRedirect = () => {
  const onboardingDone = localStorage.getItem('evo_onboarding_completed') === 'true';
  if (onboardingDone) {
    return <Navigate to="/dashboard" replace />;
  }
  return <WelcomeView />;
};

// 修复后：检查后端数据
const RootRedirect = () => {
  const [loading, setLoading] = useState(true);
  const [hasCourses, setHasCourses] = useState(false);

  useEffect(() => {
    const checkUserCourses = async () => {
      try {
        // 1. 快速检查 localStorage（性能优化）
        const onboardingDone = localStorage.getItem('evo_onboarding_completed') === 'true';
        if (onboardingDone) {
          setHasCourses(true);
          setLoading(false);
          return;
        }

        // 2. 调用后端 API 检查课程（跨设备支持）
        const { getUserCourses } = await import('./utils/api');
        const data = await getUserCourses();
        
        if (data.courses && data.courses.length > 0) {
          // 用户有课程，更新 localStorage 并跳转
          localStorage.setItem('evo_onboarding_completed', 'true');
          setHasCourses(true);
        } else {
          // 新用户，显示 Onboarding
          setHasCourses(false);
        }
      } catch (error) {
        // 出错时假设是新用户（降级处理）
        setHasCourses(false);
      } finally {
        setLoading(false);
      }
    };

    checkUserCourses();
  }, []);

  if (loading) {
    return <LoadingSpinner />;
  }

  return hasCourses ? <Navigate to="/courses" replace /> : <WelcomeView />;
};
```

#### 2. 路由更新

**修改前：**
```typescript
<Route path="/dashboard" element={<CoursesDashboard />} />
```

**修改后：**
```typescript
<Route path="/courses" element={<CoursesDashboard />} />
<Route path="/dashboard" element={<Navigate to="/courses" replace />} />
```

#### 3. 全局路由更新

所有引用 `/dashboard` 的地方改为 `/courses`：

| 文件 | 修改内容 |
|------|---------|
| **BottomNav.tsx** | `navigate('/dashboard')` → `navigate('/courses')` |
| **ProfileView.tsx** | `navigate('/dashboard')` → `navigate('/courses')` |
| **DiscoveryList.tsx** | `navigate('/dashboard?tab=...')` → `navigate('/courses?tab=...')` |

---

## 🔄 用户流程对比

### 修复前

```
用户登录
  ↓
跳转到 /
  ↓
检查 localStorage['evo_onboarding_completed']
  ↓
├─ true → Dashboard
└─ false → Onboarding（即使用户已有课程）❌
```

### 修复后

```
用户登录
  ↓
跳转到 /
  ↓
检查 localStorage（快速路径）
  ├─ 有标记 → Dashboard ✅
  └─ 无标记 ↓
      检查后端课程数据
        ├─ 有课程 → 设置标记 → Dashboard ✅
        └─ 无课程 → Onboarding ✅
```

---

## 📊 场景覆盖

### 场景 1: 首次注册用户

```
注册 → / → 后端无课程 → Onboarding → 创建课程 → Dashboard
✅ 正确流程
```

### 场景 2: 老用户换设备登录

```
登录 → / → localStorage 空 → 后端有课程 → Dashboard
✅ 直接进入 Dashboard，无需重复 Onboarding
```

### 场景 3: 老用户清除缓存后刷新

```
刷新 → / → localStorage 空 → 后端有课程 → Dashboard
✅ 自动恢复状态
```

### 场景 4: localStorage 有标记的用户

```
登录 → / → localStorage 有标记 → Dashboard（无 API 调用）
✅ 快速进入，性能优化
```

---

## ⚡ 性能优化

### 双层检查策略

1. **第一层：localStorage**
   - 优先检查 localStorage
   - 如果有 `evo_onboarding_completed` 标记
   - 直接跳转，无需 API 调用
   - **优势**：快速响应，无网络延迟

2. **第二层：后端 API**
   - localStorage 无标记时才调用
   - 调用 `getUserCourses()` 检查课程
   - 结果缓存到 localStorage
   - **优势**：支持跨设备，数据准确

### API 调用时机

只在以下情况调用后端：
- ✅ localStorage 无 onboarding 标记
- ❌ 不在每次页面加载时调用
- ❌ 不在有标记时重复调用

---

## 🔒 错误处理

### API 调用失败

```typescript
try {
  const data = await getUserCourses();
  // ...处理结果
} catch (error) {
  console.error('Failed to check user courses:', error);
  // 降级策略：假设是新用户，显示 Onboarding
  setHasCourses(false);
}
```

**原因**：
- 网络问题不应该阻止新用户注册
- 宁可让老用户看到 Onboarding（可跳过）
- 也不要让新用户无法进入应用

---

## 🧪 测试场景

### 测试 1: 新用户注册

```bash
1. 清除浏览器数据
2. 注册新账户
3. 验证：进入 Onboarding ✅
4. 完成 Onboarding 创建课程
5. 验证：进入 Dashboard ✅
```

### 测试 2: 老用户重新登录（同设备）

```bash
1. 已有课程的用户登出
2. 重新登录
3. 验证：直接进入 Dashboard（无 API 调用）✅
```

### 测试 3: 老用户换设备登录

```bash
1. 在设备 A 创建课程
2. 在设备 B 登录同一账户
3. 验证：显示加载动画 → 进入 Dashboard ✅
4. 验证：设备 B 的 localStorage 设置了标记 ✅
```

### 测试 4: 清除 localStorage 后刷新

```bash
1. 老用户在 Dashboard
2. F12 → Application → Clear localStorage
3. 刷新页面
4. 验证：显示加载 → 进入 Dashboard ✅
5. 验证：localStorage 标记恢复 ✅
```

### 测试 5: 网络错误处理

```bash
1. 清除 localStorage
2. 断开网络
3. 刷新页面
4. 验证：进入 Onboarding（降级处理）✅
```

---

## 📝 修改文件列表

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| **App.tsx** | 重要修改 | 智能 RootRedirect 组件 |
| **App.tsx** | 路由修改 | `/dashboard` → `/courses` + 别名 |
| **LoginView.tsx** | 逻辑优化 | 登录后跳转到 `/` 由根路由判断 |
| **BottomNav.tsx** | 路由更新 | 导航链接改为 `/courses` |
| **ProfileView.tsx** | 路由更新 | 返回链接改为 `/courses` |
| **DiscoveryList.tsx** | 路由更新 | 导航链接改为 `/courses` |

---

## 🎯 用户体验提升

### Before ❌
- 老用户换设备登录要重新 Onboarding
- 清除缓存后体验中断
- 无法判断用户真实状态

### After ✅
- 老用户无论哪里登录都直接进 Dashboard
- 清除缓存后自动恢复状态
- 基于后端数据判断，准确可靠

---

## 🔄 向后兼容

### `/dashboard` 路由保留

```typescript
<Route path="/dashboard" element={<Navigate to="/courses" replace />} />
```

**原因**：
- 老的链接、书签仍然有效
- 平滑迁移，不影响现有用户

---

## 📚 相关文档

- [LOCALSTORAGE_CLEANUP_COMPLETE.md](./LOCALSTORAGE_CLEANUP_COMPLETE.md) - localStorage 清理说明
- [COURSE_PERSISTENCE_FIX.md](./COURSE_PERSISTENCE_FIX.md) - 课程持久化修复
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - 测试指南

---

## ✅ 验收标准

- [x] 新用户注册后进入 Onboarding
- [x] 老用户登录后直接进 Dashboard
- [x] 跨设备登录正确识别老用户
- [x] localStorage 清除后自动恢复
- [x] API 错误不影响新用户注册
- [x] 性能优化（localStorage 快速路径）
- [x] 无 linter 错误
- [x] 向后兼容（`/dashboard` 重定向）

---

**修复完成日期**: 2026-02-07  
**修复类型**: 路由逻辑优化 + 用户体验提升  
**影响范围**: 登录流程、根路由判断、全局导航
