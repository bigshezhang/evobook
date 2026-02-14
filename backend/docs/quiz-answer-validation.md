# Quiz Answer Validation Enhancement

## 问题描述

Quiz生成时，LLM有时会漏掉参考答案字段（`answer`或`answers`），导致生成的Quiz无法正常使用。

## 解决方案

通过两个方面来解决这个问题：

### 1. 数据库查询工具

创建了脚本 `scripts/check_quiz_missing_answers.py` 用于检查数据库中已存在的缺少答案的Quiz数据。

**功能：**
- 查询所有quiz_attempts表中的数据
- 检测每个问题是否有必需的答案字段
- 生成详细的报告，包括：
  - 缺失答案的attempt ID
  - 用户信息和课程信息
  - 具体哪些问题缺少答案
- 将结果保存到 `.out/quiz_missing_answers.json`

**使用方法：**
```bash
cd backend
python3 scripts/check_quiz_missing_answers.py
```

**输出示例：**
```
Total quiz attempts in database: 45
================================================================================

🚨 Found 3 quiz attempts with missing answers:

Attempt ID: 123e4567-e89b-12d3-a456-426614174000
  User ID: 987e6543-e21a-12d3-a456-426614174000
  Course Map ID: 456e7890-e12b-34c5-a678-426614174000
  Node ID: 5
  Score: 85
  Created: 2026-02-14T10:30:00
  Total Questions: 10
  Missing Answers in Questions:
    - Question 3 (type: single): What is the result of 2 + 2?
    - Question 7 (type: multi): Which of the following are programming languages?
--------------------------------------------------------------------------------

📝 Detailed results saved to: .out/quiz_missing_answers.json
```

### 2. LLM输出格式检测和重试机制

修改了 `app/domain/services/quiz_service.py`，增强了Quiz生成的验证和重试逻辑。

**改进内容：**

#### a) 新增答案检测函数 `_check_missing_answers()`

在LLM返回结果后，专门检查每个问题是否包含必需的答案字段：

- `single` 类型：必须有 `answer` 字段
- `multi` 类型：必须有 `answers` 字段（或 `answer` 字段）
- `boolean` 类型：必须有 `answer` 字段

**检测逻辑：**
```python
def _check_missing_answers(self, questions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """检查是否有问题缺少必需的答案字段"""
    issues = []
    for idx, question in enumerate(questions):
        qtype = question.get("qtype")
        # 根据问题类型检查对应的答案字段
        if qtype == "single" and "answer" not in question:
            issues.append({...})
        # ... 其他类型检查
    return issues
```

#### b) 新增错误格式化函数 `_format_error_message_for_retry()`

将检测到的错误格式化成清晰的错误信息，反馈给LLM重试：

```python
def _format_error_message_for_retry(self, error: LLMValidationError) -> str:
    """格式化错误信息给LLM重试"""
    # 如果是答案缺失错误，生成详细的错误列表
    # 包括：问题索引、类型、缺失的字段、问题文本
    return formatted_error_message
```

#### c) 增强 `generate_quiz()` 方法的重试机制

```python
async def generate_quiz(
    self,
    language: str,
    mode: str,
    learned_topics: list[dict[str, str]],
    user_id: UUID | None = None,
    max_retries: int = 2,  # 新增参数：最大重试次数
) -> dict[str, Any]:
```

**重试流程：**

1. **第一次生成**：正常调用LLM生成Quiz
2. **验证检测**：调用 `_check_missing_answers()` 检测是否有答案缺失
3. **如果有问题**：
   - 格式化错误信息
   - 将错误信息添加到prompt中
   - 重新调用LLM生成
   - 最多重试2次
4. **成功或失败**：
   - 成功：返回完整的Quiz数据
   - 失败：抛出 `LLMValidationError` 异常

**重试时的Prompt格式：**
```
[原始Prompt内容]

# IMPORTANT - Previous Generation Error
The previous quiz generation had the following issue:

Found 2 question(s) with missing answers:
  - Question 3 (type: single): Missing 'answer' field (required for single-choice questions)
    Prompt: What is the result of 2 + 2?
  - Question 7 (type: multi): Missing 'answers' field (required for multi-choice questions)
    Prompt: Which of the following are programming languages?

Please regenerate the quiz and make sure ALL questions have the required answer fields:
- 'single' type questions MUST have an 'answer' field (string)
- 'multi' type questions MUST have an 'answers' field (array of strings)
- 'boolean' type questions MUST have an 'answer' field (string: 'True' or 'False')
```

### 3. 测试脚本

创建了 `scripts/test_quiz_answer_validation.py` 用于测试新的验证逻辑。

**测试内容：**
- 测试正常的Quiz生成流程
- 测试 `_check_missing_answers()` 函数
- 测试错误信息格式化功能

**使用方法：**
```bash
cd backend
python3 scripts/test_quiz_answer_validation.py
```

## 技术细节

### 验证规则

| 问题类型 | 必需字段 | 字段类型 | 示例 |
|---------|---------|---------|------|
| single  | `answer` | string | `"answer": "B"` |
| multi   | `answers` (或 `answer`) | array[string] | `"answers": ["A", "C"]` |
| boolean | `answer` | string | `"answer": "True"` |

### 日志记录

增强的验证逻辑会记录以下日志：

- **警告日志**：重试时记录错误信息和重试次数
  ```
  WARNING: Retrying quiz generation with error feedback
    attempt=2, error="Quiz questions missing required answer fields"
  ```

- **成功日志**：记录生成成功和重试次数
  ```
  INFO: Quiz generated successfully
    title="Python Variables Quiz", questions_count=10, attempts=2
  ```

- **错误日志**：最终失败时记录详细错误
  ```
  ERROR: Quiz generation failed after all retries
    max_retries=2, error="Quiz questions missing required answer fields"
  ```

## 影响范围

### 修改的文件
- ✅ `backend/app/domain/services/quiz_service.py` - 增强验证逻辑
- ✅ `backend/scripts/check_quiz_missing_answers.py` - 新增：数据库查询工具
- ✅ `backend/scripts/test_quiz_answer_validation.py` - 新增：测试脚本
- ✅ `backend/docs/quiz-answer-validation.md` - 新增：本文档

### API接口变化
无破坏性变化。`POST /api/v1/quiz/generate` 接口行为保持不变，但内部会进行更严格的验证和自动重试。

### 向后兼容性
完全向后兼容，现有代码无需修改。

## 使用建议

### 开发环境
1. 定期运行 `check_quiz_missing_answers.py` 检查生产数据
2. 如果发现问题，可以考虑重新生成这些Quiz

### 监控
建议监控以下指标：
- Quiz生成的重试率
- 最终失败率（经过重试仍然失败）
- 重试成功率

可以通过日志聚合工具统计这些指标。

## 示例

### 检查数据库
```bash
cd backend
python3 scripts/check_quiz_missing_answers.py
```

### 运行测试
```bash
cd backend
python3 scripts/test_quiz_answer_validation.py
```

### 查看重试日志
```bash
# 查看重试相关的日志
grep "Retrying quiz generation" backend/logs/app.log

# 查看失败的日志
grep "Quiz generation failed" backend/logs/app.log
```

## FAQ

**Q: 重试会不会影响性能？**
A: 只有在检测到答案缺失时才会重试，正常情况下不会触发。最多重试2次，预期绝大多数情况下第一次就能成功。

**Q: 如果重试2次都失败了怎么办？**
A: 会抛出 `LLMValidationError` 异常，API会返回500错误。这种情况应该极少发生，如果频繁发生，需要检查LLM的配置或prompt。

**Q: 现有数据库中的问题数据怎么办？**
A: 可以使用 `check_quiz_missing_answers.py` 找出这些数据，然后考虑：
1. 如果是draft（score为null），可以删除让用户重新生成
2. 如果是已提交的（有score），需要人工评估是否影响使用

**Q: 重试时会生成完全不同的Quiz吗？**
A: 是的，每次重试都是重新生成。这是因为LLM是非确定性的，但新的Quiz会基于相同的learned_topics和mode，质量应该保持一致。

## 总结

通过这次增强，我们实现了：
1. ✅ 数据库问题数据的诊断工具
2. ✅ LLM输出的严格验证
3. ✅ 智能的重试机制（带错误反馈）
4. ✅ 完整的测试覆盖

这应该能大幅降低Quiz生成时漏掉答案的问题。
