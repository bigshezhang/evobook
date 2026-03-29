# 维度三：AI Native — 评分 B

> LLM 层有完整的重试/落库/mock 机制，但手写 HTTP 调用且未利用 AI SDK 能力

---

## 当前 AI 能力盘点

### LLM 调用链路

```
Feature Service → completeLLM() → callGeminiAPI() → Gemini REST API
                       ↕
              prompt_runs 表（落库）
```

**使用 LLM 的切片**：onboarding、course-map、node-content、quiz（共 4 个，通过 `completeLLM` 统一入口）

### 已做好的部分

| 能力 | 实现 | 评价 |
|------|------|------|
| 统一入口 | `completeLLM()` | ✅ 所有 LLM 调用走一个函数 |
| 重试退避 | `2^attempt * 1000ms` | ✅ 合理策略 |
| 全量落库 | `prompt_runs` 表 | ✅ 成功/失败都持久化 |
| 输出校验 | `validateOutput` json/yaml/markdown/text | ✅ 防止非法输出 |
| Mock 模式 | `MOCK_LLM=true` | ✅ 开发效率高 |
| Prompt 模板化 | `prompts/*.txt` 文件 | ✅ 非工程师可维护 |
| requestId 追踪 | `crypto.randomUUID()` | ✅ 可关联日志 |
| promptHash 去重 | SHA-256 | ✅ 理论可做缓存命中 |

---

## 问题与改进

### 问题 1（P0）：API Key 暴露在 URL 中

```typescript
// llm.ts L133
const url = `${LLM_BASE_URL}/v1beta/models/${LLM_MODEL}:generateContent?key=${LLM_API_KEY}`;
```

API Key 作为 URL 查询参数，会出现在：
- Server 端日志（Hono logger 记录完整 URL）
- 错误追踪系统（如果有 Sentry）
- 网络监控/CDN 日志

**修复**：改为 Header 传递：

```typescript
const url = `${LLM_BASE_URL}/v1beta/models/${LLM_MODEL}:generateContent`;
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-goog-api-key': LLM_API_KEY,
  },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
});
```

Gemini API 官方支持 `x-goog-api-key` header。

---

### 问题 2（P0）：promptHash 计算在变量替换之前

```typescript
// llm.ts L210-218（顺序问题）
const hashSource = (systemMessage ?? '') + rawPromptText;  // hash 算在替换前
const promptHash = calculatePromptHash(hashSource);

let promptText = rawPromptText;
if (variables) {
  for (const [key, value] of Object.entries(variables)) {
    promptText = promptText.replaceAll(`{${key}}`, value);
  }
}
```

不同变量输入 → 相同 hash → 无法通过 hash 区分同模板的不同调用 → `prompt_runs` 中 hash 字段失去意义。

**修复**：移动 hash 计算到变量替换之后。

---

### 问题 3（P1）：缺少 Token 使用量追踪

Gemini API 返回体包含 `usageMetadata`：
```json
{
  "usageMetadata": {
    "promptTokenCount": 1234,
    "candidatesTokenCount": 567,
    "totalTokenCount": 1801
  }
}
```

当前完全忽略这个字段。

**改进**：

1. 解析 `usageMetadata` 并添加到 `LLMResponse`：
```typescript
interface LLMResponse {
  // ...existing fields
  promptTokens?: number;
  completionTokens?: number;
}
```

2. 扩展 `prompt_runs` 表：
```sql
ALTER TABLE prompt_runs ADD COLUMN prompt_tokens integer;
ALTER TABLE prompt_runs ADD COLUMN completion_tokens integer;
```

3. 可以据此计算每个 feature 的 AI 成本：
```sql
SELECT prompt_name, SUM(prompt_tokens + completion_tokens) as total_tokens
FROM prompt_runs WHERE success = true
GROUP BY prompt_name;
```

---

### 问题 4（P1）：模型锁定为 Gemini

`callGeminiAPI` 硬编码了 Gemini REST API 格式（`generateContent`、`systemInstruction`、`candidates`）。

**不建议立即引入 AI SDK**（Vercel AI SDK 偏重 streaming UI），但建议抽象 Provider 接口：

```typescript
// src/lib/llm/provider.ts
export interface LLMProvider {
  generate(params: {
    prompt: string;
    systemMessage?: string;
    timeoutMs: number;
  }): Promise<{
    text: string;
    usage?: { promptTokens: number; completionTokens: number };
  }>;
}
```

```typescript
// src/lib/llm/gemini-provider.ts — 将现有 callGeminiAPI 迁移过来
export class GeminiProvider implements LLMProvider { ... }
```

好处：切换模型只需新增 provider，`completeLLM` 内部逻辑不变。

---

### 问题 5（P1）：变量替换不安全

```typescript
promptText = promptText.replaceAll(`{${key}}`, value);
```

- 变量值包含 `{` 字符时可能触发非预期替换
- 未替换的占位符被静默传入 LLM

**改进**：增加未替换检测：

```typescript
if (variables) {
  for (const [key, value] of Object.entries(variables)) {
    promptText = promptText.replaceAll(`{${key}}`, value);
  }
  const unreplaced = promptText.match(/\{[a-zA-Z_]+\}/g);
  if (unreplaced) {
    console.warn(`[llm] Unreplaced variables: ${unreplaced.join(', ')}`);
  }
}
```

---

### 问题 6（P2）：Mock 数据硬编码在生产代码中

`MOCK_RESPONSES` 对象占 llm.ts 约 40 行，包含完整的 mock JSON。生产构建中包含了不需要的测试数据。

**改进方案选择**：

**方案 A**（最小改动）：将 mock 数据移到 `src/lib/prompts/mocks/*.json`：

```typescript
if (USE_MOCK_LLM) {
  const mockPath = join(dirname(fileURLToPath(import.meta.url)), 'prompts/mocks', `${promptName}.json`);
  const mockText = readFileSync(mockPath, 'utf-8');
  // ...
}
```

**方案 B**（推荐）：提取为 `MockProvider`，实现 LLMProvider 接口。

---

### 问题 7（P2）：无 Streaming 支持

知识卡片生成可能耗时 5-10 秒，用户看到的是完整加载等待。

**未来改进方向**：
- Gemini API 支持 `streamGenerateContent`
- 搭配 tRPC subscription 或 SSE 实现流式返回
- 适用场景：知识卡片、onboarding 对话

**当前不急**：batch 预生成模式下，用户打开卡片时内容已就绪，streaming 不是刚需。

---

### 问题 8（P3）：死依赖

```json
"@ai-sdk/openai": "^1.3.22"
```

代码中未 import，浪费 `node_modules` 空间，且可能误导维护者以为项目使用了 AI SDK。

**行动**：直接移除。

---

## AI Native 成熟度模型

| 等级 | 能力 | 当前状态 |
|------|------|---------|
| L1 | 有 LLM 调用 | ✅ |
| L2 | 统一入口 + 重试 + 日志 | ✅ |
| L3 | 全量 prompt 落库 + 可追溯 | ✅ |
| L4 | Token 成本追踪 | ❌ 缺失 |
| L5 | 多模型支持 + Provider 切换 | ❌ 缺失 |
| L6 | Streaming 输出 | ❌ 缺失 |
| L7 | Prompt 版本管理 + A/B 测试 | ❌ 缺失 |
| L8 | 自动质量评估 + 反馈循环 | ❌ 缺失 |

当前处于 **L3**，目标 **L5**（Token 追踪 + Provider 抽象即可达到）。

---

## 改进优先级

| 优先级 | 改动 | 工作量 |
|--------|------|--------|
| P0 | API Key 从 URL 移到 Header | 10 分钟 |
| P0 | 修复 promptHash 计算顺序 | 10 分钟 |
| P1 | Token usage 追踪 + 落库 | 2 小时 |
| P1 | Provider 接口抽象 | 半天 |
| P1 | 变量替换安全检查 | 15 分钟 |
| P2 | Mock 数据外移 | 1 小时 |
| P3 | 移除 @ai-sdk/openai | 5 分钟 |
