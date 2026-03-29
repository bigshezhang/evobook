# LLM 集成层改进

## 现状分析

`src/lib/llm.ts` 是所有 AI 功能的入口，当前实现有以下特点：

### 做得好的部分

1. **统一入口 `completeLLM`**：所有 LLM 调用走同一个函数，便于监控和管理
2. **全量落库 `prompt_runs`**：成功/失败都持久化，便于调试和成本追踪
3. **指数退避重试**：`2^attempt * 1000ms`，合理的重试策略
4. **输出格式校验**：`validateOutput` 按 json/yaml/markdown/text 分别校验
5. **Mock 模式**：`MOCK_LLM=true` 一键切换，开发效率高
6. **Prompt 模板文件化**：`.txt` 文件，非工程师可维护

### 存在的问题

---

## 问题 1: 手写 HTTP 调用，锁死 Gemini

当前直接用 `fetch` 调 Gemini REST API：

```typescript
// llm.ts L129-133
const url = `${LLM_BASE_URL}/v1beta/models/${LLM_MODEL}:generateContent?key=${LLM_API_KEY}`;
```

**影响**：
- 切换到 OpenAI / Claude / DeepSeek 需要重写底层代码
- API Key 暴露在 URL 查询参数中（会出现在 server log、网络监控、错误追踪中）
- 没有 streaming 支持（长内容生成时用户体验差）
- 没有 token 统计（无法精确计算成本）
- 没有 tool calling / structured output 等高级能力
- `@ai-sdk/openai` 在 `package.json` 中声明但完全未使用（死依赖）

### 建议：引入 Provider 抽象

不一定需要引入 Vercel AI SDK（它偏重 streaming UI 场景），但应该抽象出 provider 接口：

```typescript
// src/lib/llm/provider.ts
export interface LLMProvider {
  generateContent(params: {
    prompt: string;
    systemMessage?: string;
    timeoutMs: number;
  }): Promise<{ text: string; usage?: { promptTokens: number; completionTokens: number } }>;
}

// src/lib/llm/gemini-provider.ts
export class GeminiProvider implements LLMProvider {
  constructor(
    private apiKey: string,
    private baseUrl: string,
    private model: string,
  ) {}

  async generateContent(params) {
    // 现有 callGeminiAPI 逻辑迁移到这里
    // 但 API Key 放在 header 里，而不是 URL 参数
  }
}
```

**好处**：
- 切换模型只需新增 provider 实现
- API Key 不在 URL 中暴露
- 可以为不同 prompt 指定不同 provider（如 onboarding 用便宜模型，quiz 用高质量模型）

---

## 问题 2: Mock 数据硬编码在生产代码中

`MOCK_RESPONSES` 对象占据了 llm.ts 约 40 行（L32-L76），包含完整的 mock JSON。

**影响**：
- 生产构建中包含了测试用的 mock 数据
- 修改 mock 需要编辑基础设施层代码
- mock 数据结构与真实 LLM 返回可能不同步

### 建议：Mock 提取到测试目录

```typescript
// src/lib/llm/mock-provider.ts（仅开发构建包含）
export class MockProvider implements LLMProvider {
  private responses: Record<string, string>;

  constructor() {
    this.responses = loadMockResponses();
  }

  async generateContent(params) {
    return { text: this.responses[params.promptName] ?? '{}', usage: undefined };
  }
}
```

或者更简单的方案：将 mock 数据移到 `src/lib/prompts/mocks/` 目录下的 JSON 文件中，与 prompt 模板保持邻近。

---

## 问题 3: 变量替换过于简单

```typescript
// llm.ts L214-218
if (variables) {
  for (const [key, value] of Object.entries(variables)) {
    promptText = promptText.replaceAll(`{${key}}`, value);
  }
}
```

**影响**：
- 如果变量值中包含 `{` 字符，会触发非预期替换
- 不支持默认值、条件逻辑、列表展开
- 没有检测未替换的变量占位符（silent failure）

### 建议：增加安全检查

最小改动方案——不需要引入模板引擎，但加上安全检查：

```typescript
if (variables) {
  for (const [key, value] of Object.entries(variables)) {
    promptText = promptText.replaceAll(`{${key}}`, value);
  }
  // 检测是否有未替换的占位符
  const unreplaced = promptText.match(/\{[a-zA-Z_]+\}/g);
  if (unreplaced) {
    console.warn(`[llm] Unreplaced variables in prompt: ${unreplaced.join(', ')}`);
  }
}
```

---

## 问题 4: promptHash 计算包含了 systemMessage

```typescript
const hashSource = (systemMessage ?? '') + rawPromptText;
const promptHash = calculatePromptHash(hashSource);
```

但变量替换是在 hash 计算**之后**进行的（L213-218 在 L210-211 之后）。这意味着不同的变量输入会产生相同的 hash，无法通过 hash 区分相同模板的不同调用。

### 建议

将 hash 计算移到变量替换之后：

```typescript
let promptText = rawPromptText;
if (variables) {
  for (const [key, value] of Object.entries(variables)) {
    promptText = promptText.replaceAll(`{${key}}`, value);
  }
}
const hashSource = (systemMessage ?? '') + promptText;
const promptHash = calculatePromptHash(hashSource);
```

---

## 问题 5: 缺少 token 使用量追踪

Gemini API 返回的 response 中包含 `usageMetadata`（`promptTokenCount`、`candidatesTokenCount`），但当前完全忽略了这个字段。

### 建议

在 `callGeminiAPI` 中解析并返回 usage：

```typescript
interface GeminiResult {
  text: string;
  usage?: { promptTokens: number; completionTokens: number };
}

// 解析 response
const usage = data.usageMetadata ? {
  promptTokens: data.usageMetadata.promptTokenCount ?? 0,
  completionTokens: data.usageMetadata.candidatesTokenCount ?? 0,
} : undefined;
```

并扩展 `prompt_runs` 表记录 token 使用：

```sql
ALTER TABLE prompt_runs ADD COLUMN prompt_tokens integer;
ALTER TABLE prompt_runs ADD COLUMN completion_tokens integer;
```

这对成本监控至关重要，尤其是当用户量增长后。

---

## 建议的目标文件结构

```
src/lib/
  llm/
    index.ts           # 导出 completeLLM（保持外部 API 不变）
    provider.ts        # LLMProvider 接口定义
    gemini-provider.ts # Gemini 实现
    mock-provider.ts   # Mock 实现
    validator.ts       # validateOutput 提取
    types.ts           # LLMResponse, OutputFormat 等
  prompts/
    *.txt              # Prompt 模板（不变）
    mocks/             # Mock 响应数据（可选）
```

保持 `completeLLM` 的外部签名不变，内部重构不影响任何 feature service。

---

## 优先级

| 优先级 | 改动 | 工作量 | 风险 |
|--------|------|--------|------|
| P0 | API Key 从 URL 参数移到 Header | 小 | 极低 |
| P0 | 修复 promptHash 计算顺序 | 小 | 极低 |
| P1 | 添加 token usage 追踪 | 中 | 低 |
| P1 | 添加未替换变量检测 | 小 | 极低 |
| P2 | 提取 Provider 抽象 | 中 | 低（保持外部 API 不变） |
| P2 | Mock 数据外移 | 小 | 低 |
| P3 | 移除未使用的 `@ai-sdk/openai` 依赖 | 小 | 无 |
