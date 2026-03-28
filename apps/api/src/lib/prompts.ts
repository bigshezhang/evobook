import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// 白名单 prompt 名称到文件名映射
const PROMPT_MAP: Record<string, string> = {
  onboarding: 'onboarding.txt',
  dag: 'dag.txt',
  knowledge_card: 'knowledge_card.txt',
  clarification: 'clarification.txt',
  qa_detail: 'qa_detail.txt',
  quiz: 'quiz.txt',
};

const __dirname = dirname(fileURLToPath(import.meta.url));

// 缓存已加载的 prompt 内容，避免重复读盘
const promptCache = new Map<string, string>();

export function loadPrompt(name: string): string {
  const cached = promptCache.get(name);
  if (cached) return cached;

  const filename = PROMPT_MAP[name];
  if (!filename) {
    throw new Error(
      `Unknown prompt name: ${name}. Valid: ${Object.keys(PROMPT_MAP).join(', ')}`,
    );
  }

  const content = readFileSync(join(__dirname, 'prompts', filename), 'utf-8');
  promptCache.set(name, content);
  return content;
}
