// ─── Types ───────────────────────────────────────────────────────────────────

export interface DailyMindlogData {
  date: string;
  diaries: { content: string; moodTags: string[]; createdAt: string }[];
  knowledgeOps: { title: string; type: string; topicTags: string[] }[];
  creationArticles: { title: string; sourcePlatform?: string }[];
}

export interface WeeklyMindlogData {
  weekStart: string;
  weekEnd: string;
  dailyMindlogs: { keywords: string; content: string; date: string }[];
  diaryCount: number;
  knowledgeCount: number;
}

export interface MonthlyMindlogData {
  month: string;
  weeklyMindlogs: { keywords: string; content: string; weekStart: string }[];
  diaryCount: number;
  knowledgeCount: number;
  creationCount: number;
}

// ─── System Prompt (共用角色设定) ─────────────────────────────────────────────

const MINDLOG_ROLE = `你是 MindOS 的心智日志生成器。你的工作是读取用户的日记、知识库操作、创作记录，从中提炼心智快照。

## 角色规则
- 口吻：陈述句，不提问；用"你"但指向"我"（用户的自我对话）
- 禁止：不鼓励、不评判、不庆祝、不惋惜
- 像心智系统在读取自己的日志
- 宁可缺失某板块，也不可用模糊内容填充
- 优先使用用户原话
- 输出必须是合法 JSON`;

// ─── Daily ────────────────────────────────────────────────────────────────────

const DAILY_SYSTEM = `${MINDLOG_ROLE}

## 输出结构（每日 MindLog）

你需要输出一个 JSON 对象，包含以下字段：
- keywords: 核心关键词（1-2个词，用"·"连接）
- content: 完整结构化文本，包含以下板块（用 Markdown 加粗标记每个板块名）：
  - 核心关键词
  - 心念标记：一句话，捕捉近日意识的瞬间留痕
  - 情绪底色：一个准确的形容词
  - 洞见闪光："叮"一下的新认知
  - 迭代微词：一句系统提示，心智的微小转向，不超过30字
- dashboardSummary: 仪表盘总结，格式如下：
  关键词：XX · XX
  日记记录：X篇
  知识库操作：X次
  情绪底色：XX
  （一句话简短总结）

## 输出格式

严格输出如下 JSON，不要包含任何其他文字：
{"keywords":"...","content":"...","dashboardSummary":"..."}`;

function buildDailyUserPrompt(data: DailyMindlogData): string {
  const parts: string[] = [`日期：${data.date}`];

  if (data.diaries.length > 0) {
    parts.push('\n## 日记内容');
    data.diaries.forEach((d, i) => {
      parts.push(`\n### 日记 ${i + 1}（${d.createdAt}）`);
      if (d.moodTags.length > 0) parts.push(`情绪标签：${d.moodTags.join('、')}`);
      parts.push(d.content);
    });
  }

  if (data.knowledgeOps.length > 0) {
    parts.push('\n## 知识库操作');
    data.knowledgeOps.forEach((k) => {
      const tags = k.topicTags.length > 0 ? `（${k.topicTags.join('、')}）` : '';
      parts.push(`- [${k.type}] ${k.title}${tags}`);
    });
  }

  if (data.creationArticles.length > 0) {
    parts.push('\n## 创作记录');
    data.creationArticles.forEach((a) => {
      const platform = a.sourcePlatform ? `（${a.sourcePlatform}）` : '';
      parts.push(`- ${a.title}${platform}`);
    });
  }

  parts.push(`\n统计：日记 ${data.diaries.length} 篇，知识库操作 ${data.knowledgeOps.length} 次`);

  return parts.join('\n');
}

export function buildDailyMindlogPrompt(data: DailyMindlogData): { system: string; user: string } {
  return {
    system: DAILY_SYSTEM,
    user: buildDailyUserPrompt(data),
  };
}

// ─── Weekly ───────────────────────────────────────────────────────────────────

const WEEKLY_SYSTEM = `${MINDLOG_ROLE}

## 输出结构（每周 MindLog）

你需要输出一个 JSON 对象，包含以下字段：
- keywords: 本周关键词（1-2个词，用"·"连接）
- content: 完整结构化文本，包含以下板块（用 Markdown 加粗标记每个板块名）：
  - 本周关键词
  - 反复心念：本周意识反复落在哪个区域？
  - 主导情绪流：一周情绪的起承转合，描述变化轨迹
  - 汇聚洞见：本周零散的"叮"汇聚后，指向什么更大的认知？
  - 模式提醒：什么模式正在重复？这是养料还是消耗？
  - 迭代微词：基于模式，给下周一句转向提示
- dashboardSummary: 一句话周总结

## 输出格式

严格输出如下 JSON，不要包含任何其他文字：
{"keywords":"...","content":"...","dashboardSummary":"..."}`;

function buildWeeklyUserPrompt(data: WeeklyMindlogData): string {
  const parts: string[] = [`周期：${data.weekStart} ~ ${data.weekEnd}`];
  parts.push(`统计：日记 ${data.diaryCount} 篇，知识库操作 ${data.knowledgeCount} 次`);

  if (data.dailyMindlogs.length > 0) {
    parts.push('\n## 本周每日 MindLog');
    data.dailyMindlogs.forEach((m) => {
      parts.push(`\n### ${m.date}（关键词：${m.keywords}）`);
      parts.push(m.content);
    });
  }

  return parts.join('\n');
}

export function buildWeeklyMindlogPrompt(data: WeeklyMindlogData): { system: string; user: string } {
  return {
    system: WEEKLY_SYSTEM,
    user: buildWeeklyUserPrompt(data),
  };
}

// ─── Monthly ──────────────────────────────────────────────────────────────────

const MONTHLY_SYSTEM = `${MINDLOG_ROLE}

## 输出结构（每月 MindLog）

你需要输出一个 JSON 对象，包含以下字段：
- keywords: 本月关键词（1-2个词，用"·"连接）
- content: 完整结构化文本，包含以下板块（用 Markdown 加粗标记每个板块名）：
  - 本月关键词
  - 心智地貌：本月心智的整体样貌，俯瞰视角
  - 核心张力：本月贯穿始终的内在冲突
  - 认知迁移：哪个底层概念被重写了？
  - 暗涌与伏笔：尚未成形但已开始萌芽的新方向
  - 迭代微词：基于本月的结构变迁，给下月一句核心提示
- dashboardSummary: 一句话月总结

## 输出格式

严格输出如下 JSON，不要包含任何其他文字：
{"keywords":"...","content":"...","dashboardSummary":"..."}`;

function buildMonthlyUserPrompt(data: MonthlyMindlogData): string {
  const parts: string[] = [`月份：${data.month}`];
  parts.push(`统计：日记 ${data.diaryCount} 篇，知识库操作 ${data.knowledgeCount} 次，创作 ${data.creationCount} 篇`);

  if (data.weeklyMindlogs.length > 0) {
    parts.push('\n## 本月每周 MindLog');
    data.weeklyMindlogs.forEach((m) => {
      parts.push(`\n### ${m.weekStart} 周（关键词：${m.keywords}）`);
      parts.push(m.content);
    });
  }

  return parts.join('\n');
}

export function buildMonthlyMindlogPrompt(data: MonthlyMindlogData): { system: string; user: string } {
  return {
    system: MONTHLY_SYSTEM,
    user: buildMonthlyUserPrompt(data),
  };
}
