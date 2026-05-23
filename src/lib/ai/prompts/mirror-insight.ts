import { listByType } from '@/lib/storage/mindlog-store';

// ─── System Prompt ───────────────────────────────────────────────────────────

export const MIRROR_SYSTEM_PROMPT = `你是"镜像洞见"——用户的深度洞察伙伴。你对用户有深入的了解，基于持续观察用户的思维轨迹和情感变化。

## 你的用户画像
{userProfile}

## 回答规范
1. 基于用户画像中的特征给出针对性回应，而非泛泛的通用建议
2. 当用户问题与其近期关注/情绪相关时，主动关联并提供洞察
3. 语气温和但有深度，像一位了解用户的智慧伙伴
4. 如果用户分享了链接/文件/图片，结合其知识兴趣给出个性化解读
5. 适时指出用户可能未注意到的思维模式或盲区
6. 回答简洁有力，避免冗长`;

// ─── User Profile Builder ────────────────────────────────────────────────────

export async function buildUserProfilePrompt(): Promise<string> {
  const logs = await listByType('daily', 14);

  if (logs.length === 0) {
    return '暂无足够画像数据。用户刚开始使用系统，尚未积累足够的心智日志来构建个性化画像。请以通用但友善的方式回应。';
  }

  // 聚合情绪基调
  const moods = logs
    .map((log) => log.sourceData?.moodSummary)
    .filter(Boolean) as string[];
  const moodSummary = moods.length > 0
    ? moods.join('；')
    : '';

  // 统计高频关键词
  const keywordCount = new Map<string, number>();
  for (const log of logs) {
    if (log.keywords) {
      const words = log.keywords.split(/[·,，、\s]+/).filter(Boolean);
      for (const w of words) {
        keywordCount.set(w, (keywordCount.get(w) || 0) + 1);
      }
    }
  }
  const sortedKeywords = Array.from(keywordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  const repeatingThemes = sortedKeywords
    .filter(([, count]) => count >= 2)
    .map(([word, count]) => `${word}(${count}次)`)
    .join('、');
  const topKeywords = sortedKeywords
    .map(([word]) => word)
    .join('、');

  // 思维倾向：从内容中提取特征
  const contentSnippets = logs
    .map((log) => log.content)
    .filter(Boolean)
    .join('\n');
  const thinkingPatterns = extractThinkingPatterns(contentSnippets);

  // 知识兴趣重心
  const totalKnowledge = logs.reduce(
    (sum, log) => sum + (log.sourceData?.knowledgeCount || 0),
    0
  );
  const knowledgeInterest = totalKnowledge > 0
    ? `近14天记录了${totalKnowledge}条知识笔记，主要关键词集中在：${topKeywords}`
    : '近期知识记录较少';

  // 核心价值观线索
  const valueClues = repeatingThemes
    ? `从反复出现的主题「${repeatingThemes}」中可推断用户持续关注这些方向`
    : '尚未积累足够数据推断核心价值观';

  const sections = [
    '## 用户画像（基于近14天心智日志）',
    moodSummary ? `### 近期情绪基调\n${moodSummary}` : '',
    `### 思维倾向\n${thinkingPatterns}`,
    `### 知识兴趣重心\n${knowledgeInterest}`,
    repeatingThemes ? `### 反复出现的主题\n${repeatingThemes}` : '',
    `### 核心价值观线索\n${valueClues}`,
  ].filter(Boolean);

  return sections.join('\n\n');
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function extractThinkingPatterns(content: string): string {
  const patterns: string[] = [];

  if (content.includes('反思') || content.includes('复盘')) {
    patterns.push('倾向于回顾式思考');
  }
  if (content.includes('计划') || content.includes('目标') || content.includes('规划')) {
    patterns.push('有较强的目标导向');
  }
  if (content.includes('感受') || content.includes('情绪') || content.includes('心情')) {
    patterns.push('关注内在情感体验');
  }
  if (content.includes('学习') || content.includes('知识') || content.includes('研究')) {
    patterns.push('持续学习驱动型');
  }
  if (content.includes('创作') || content.includes('灵感') || content.includes('设计')) {
    patterns.push('创造性表达倾向');
  }

  return patterns.length > 0
    ? patterns.join('、')
    : '数据尚不足以明确判断思维倾向';
}

// ─── Exported Prompt Getter ──────────────────────────────────────────────────

export async function getMirrorSystemPrompt(): Promise<string> {
  const profile = await buildUserProfilePrompt();
  return MIRROR_SYSTEM_PROMPT.replace('{userProfile}', profile);
}
