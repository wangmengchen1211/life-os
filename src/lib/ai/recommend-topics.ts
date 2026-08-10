import { getLatestByType } from '@/lib/storage/mindlog-store';
import { listEntries } from '@/lib/storage/diary-store';
import { listAllTodos } from '@/lib/storage/todo-store';
import { listItems } from '@/lib/storage/knowledge-store';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RecommendedQuestion {
  text: string;
  source: 'data' | 'static';
}

// ─── 预置主题词表 ─────────────────────────────────────────────────────────────
// 轻量中文主题匹配（不引入分词库）：从日记正文中统计出现次数生成话题

const TOPIC_KEYWORDS = [
  '工作', '学习', '健康', '感情', '家人', '朋友', '旅行', '读书', '创作',
  '健身', '项目', '焦虑', '迷茫', '成长', '复盘', '计划', '目标', '面试',
  '考试', '恋爱', '运动', '睡眠', '饮食', '代码', '设计', '写作', '摄影',
  '飞盘', '攀岩', '徒步', '副业', '理财', '心态', '效率', '专注', '拖延',
  '沟通', '情绪', '压力', '兴趣',
];

// ─── 兜底静态话题（数据不足时补齐） ────────────────────────────────────────────

export const FALLBACK_PROMPTS = [
  '分析我最近的情绪变化',
  '我的思维有什么盲区？',
  '根据我的兴趣推荐学习方向',
  '帮我梳理最近的困惑',
  '我最近的状态怎么样？',
  '有什么我忽视的信号？',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** 从文本中统计预置主题词出现次数，返回最高频词（无匹配返回 null） */
function topKeywordFrom(text: string): string | null {
  const counts = new Map<string, number>();
  for (const kw of TOPIC_KEYWORDS) {
    let idx = text.indexOf(kw);
    let n = 0;
    while (idx !== -1) {
      n++;
      idx = text.indexOf(kw, idx + kw.length);
    }
    if (n > 0) counts.set(kw, n);
  }
  if (counts.size === 0) return null;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

// ─── 主入口 ───────────────────────────────────────────────────────────────────

/**
 * 基于最近数据（心智日志/日记/Todo/知识库）生成推荐话题
 * - 本地规则提取：即时、零成本、离线可用
 * - 静态话题仅兜底，保证至少返回 limit 条
 */
export async function buildRecommendedTopics(limit = 4): Promise<RecommendedQuestion[]> {
  const result: RecommendedQuestion[] = [];
  const used = new Set<string>();
  const push = (text: string) => {
    if (used.has(text)) return;
    used.add(text);
    result.push({ text, source: 'data' });
  };

  // 1. 心智日志关键词（近况主题）
  const latestLog = await getLatestByType('daily').catch(() => undefined);
  if (latestLog?.keywords) {
    const topWord = latestLog.keywords.split('·')[0].trim();
    if (topWord) push(`「${topWord}」对我的影响是什么？`);
  }

  // 2. 日记：情绪标签 + 正文高频主题词
  const entries = await listEntries({ limit: 7 }).catch(() => []);
  const recentMoods = entries
    .flatMap((e) => e.moodTags || [])
    .filter(Boolean);
  const moodSet = [...new Set(recentMoods)];
  if (moodSet.length > 0) {
    const mood = moodSet[Math.floor(Math.random() * moodSet.length)];
    push(`为什么最近总感到「${mood}」？`);
  }
  const diaryText = entries.map((e) => e.content).join('\n');
  const topTopic = topKeywordFrom(diaryText);
  if (topTopic) push(`「${topTopic}」最近反复出现，它对你意味着什么？`);

  // 3. Todo：最近未完成事项
  const todos = await listAllTodos().catch(() => []);
  const pending = todos
    .filter((t) => !t.isCompleted)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (pending.length > 0) {
    const title = truncate(pending[0].title, 12);
    push(`最近在推进「${title}」，进展如何？`);
  }

  // 4. 知识库：最近新增条目
  const items = await listItems({ limit: 5 }).catch(() => []);
  if (items.length > 0) {
    const title = truncate(items[0].title, 12);
    push(`最近记录的「${title}」，想深入哪个方向？`);
  }

  // 5. 静态兜底：保证至少 limit 条
  if (result.length < limit) {
    const shuffled = [...FALLBACK_PROMPTS].sort(() => Math.random() - 0.5);
    for (const p of shuffled) {
      if (result.length >= limit) break;
      if (used.has(p)) continue;
      used.add(p);
      result.push({ text: p, source: 'static' });
    }
  }

  return result.slice(0, limit);
}
