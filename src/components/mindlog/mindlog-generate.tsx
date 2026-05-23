'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { listEntries as listDiaries } from '@/lib/storage/diary-store';
import { listItems } from '@/lib/storage/knowledge-store';
import { listByType, upsertEntry } from '@/lib/storage/mindlog-store';
import type { DailyMindlogData, WeeklyMindlogData, MonthlyMindlogData } from '@/lib/ai/prompts/mindlog';

interface MindlogGenerateProps {
  type: 'daily' | 'weekly' | 'monthly';
  isGenerating: boolean;
  onComplete: () => void;
  onError: (msg: string) => void;
}

export function MindlogGenerate({ type, isGenerating, onComplete, onError }: MindlogGenerateProps) {
  const [streamText, setStreamText] = useState('');
  const [status, setStatus] = useState<'idle' | 'aggregating' | 'streaming' | 'saving' | 'done'>('idle');
  const abortRef = useRef<AbortController | null>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (isGenerating && !hasStarted.current) {
      hasStarted.current = true;
      runGeneration();
    }

    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating]);

  async function runGeneration() {
    setStreamText('');
    setStatus('aggregating');

    try {
      // 1. 聚合数据
      const { periodStart, periodEnd, data } = await aggregateData(type);

      // 2. 调用 SSE 接口
      setStatus('streaming');
      abortRef.current = new AbortController();

      const response = await fetch('/api/mindlog/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, periodStart, periodEnd, data }),
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error('生成请求失败');
      }

      // 3. 解析 SSE 流
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          if (!event.startsWith('data: ')) continue;
          const payload = event.slice(6);
          let json: { type: string; content: string };
          try {
            json = JSON.parse(payload);
          } catch {
            continue;
          }

          if (json.type === 'error') {
            throw new Error(json.content || '生成出错');
          }
          if (json.type === 'text') {
            fullText += json.content;
            setStreamText(extractPreview(fullText));
          }
          if (json.type === 'done') {
            fullText = json.content;
          }
        }
      }

      // 4. 解析 JSON 并保存
      setStatus('saving');
      const parsed = extractJSON(fullText);
      if (parsed && parsed.keywords && parsed.content && parsed.dashboardSummary) {
        await upsertEntry({
          type,
          periodStart,
          periodEnd,
          keywords: parsed.keywords,
          content: parsed.content,
          dashboardSummary: parsed.dashboardSummary,
          sourceData: {
            diaryCount: getSourceDiaryCount(data),
            knowledgeCount: getSourceKnowledgeCount(data),
            moodSummary: '',
          },
          createdAt: new Date().toISOString(),
        });
        setStatus('done');
        onComplete();
      } else {
        throw new Error('AI 返回格式异常，无法解析');
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      console.error('MindLog generate error:', e);
      onError(e.message || '生成失败');
    }
  }

  const statusLabels: Record<string, string> = {
    idle: '准备中…',
    aggregating: '正在聚合数据…',
    streaming: '心智日志生成中…',
    saving: '保存中…',
    done: '完成',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="bg-white/60 backdrop-blur-sm border border-black/5 rounded-2xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
    >
      {/* 状态提示 */}
      <div className="mb-6">
        <span className="text-sm italic text-gray-400 opacity-70">
          {statusLabels[status]}
        </span>
      </div>

      {/* 流式文字展示 */}
      {streamText && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-[15px] leading-[1.8] text-gray-600 whitespace-pre-wrap"
        >
          {streamText}
          {status === 'streaming' && (
            <span className="inline-block w-1 h-4 bg-teal-400 ml-0.5 animate-pulse" />
          )}
        </motion.div>
      )}

      {/* 加载动画 */}
      {status === 'aggregating' && (
        <div className="flex items-center gap-3 py-4">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-teal-400"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
          <span className="text-sm text-gray-400">收集心智数据…</span>
        </div>
      )}
    </motion.div>
  );
}

// ─── 数据聚合 ─────────────────────────────────────────────────────────────────

async function aggregateData(type: 'daily' | 'weekly' | 'monthly'): Promise<{
  periodStart: string;
  periodEnd: string;
  data: DailyMindlogData | WeeklyMindlogData | MonthlyMindlogData;
}> {
  if (type === 'daily') {
    return aggregateDaily();
  } else if (type === 'weekly') {
    return aggregateWeekly();
  } else {
    return aggregateMonthly();
  }
}

async function aggregateDaily(): Promise<{
  periodStart: string;
  periodEnd: string;
  data: DailyMindlogData;
}> {
  const allDiaries = await listDiaries({ offset: 0, limit: 200 });
  const allItems = await listItems();

  // 先尝试昨日数据
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const yesterdayStart = `${yesterdayStr}T00:00:00.000Z`;
  const yesterdayEnd = `${yesterdayStr}T23:59:59.999Z`;

  const yesterdayDiaries = allDiaries.filter(
    (d) => d.createdAt >= yesterdayStart && d.createdAt <= yesterdayEnd
  );
  const yesterdayItems = allItems.filter(
    (k) => k.createdAt >= yesterdayStart && k.createdAt <= yesterdayEnd
  );

  // 如果昨日有数据，使用昨日
  if (yesterdayDiaries.length > 0 || yesterdayItems.length > 0) {
    const creationArticles = yesterdayItems
      .filter((k) => k.type === 'creation_article')
      .map((k) => ({ title: k.title, sourcePlatform: k.sourcePlatform }));

    const data: DailyMindlogData = {
      date: yesterdayStr,
      diaries: yesterdayDiaries.map((d) => ({
        content: d.content,
        moodTags: d.moodTags,
        createdAt: d.createdAt,
      })),
      knowledgeOps: yesterdayItems.map((k) => ({
        title: k.title,
        type: k.type,
        topicTags: k.topicTags,
      })),
      creationArticles,
    };

    return { periodStart: yesterdayStr, periodEnd: yesterdayStr, data };
  }

  // 昨日无数据，回退到今日
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const todayStart = `${todayStr}T00:00:00.000Z`;
  const todayEnd = `${todayStr}T23:59:59.999Z`;

  const todayDiaries = allDiaries.filter(
    (d) => d.createdAt >= todayStart && d.createdAt <= todayEnd
  );
  const todayItems = allItems.filter(
    (k) => k.createdAt >= todayStart && k.createdAt <= todayEnd
  );

  const creationArticles = todayItems
    .filter((k) => k.type === 'creation_article')
    .map((k) => ({ title: k.title, sourcePlatform: k.sourcePlatform }));

  const data: DailyMindlogData = {
    date: todayStr,
    diaries: todayDiaries.map((d) => ({
      content: d.content,
      moodTags: d.moodTags,
      createdAt: d.createdAt,
    })),
    knowledgeOps: todayItems.map((k) => ({
      title: k.title,
      type: k.type,
      topicTags: k.topicTags,
    })),
    creationArticles,
  };

  return { periodStart: todayStr, periodEnd: todayStr, data };
}

async function aggregateWeekly(): Promise<{
  periodStart: string;
  periodEnd: string;
  data: WeeklyMindlogData;
}> {
  const now = new Date();
  // 本周一
  const monday = new Date(now);
  const dayOfWeek = monday.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setDate(monday.getDate() + diff);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  const periodStart = monday.toISOString().slice(0, 10);
  const periodEnd = sunday.toISOString().slice(0, 10);

  // 获取本周 daily mindlogs
  const dailyMindlogs = await listByType('daily', 7);
  const weekMindlogs = dailyMindlogs.filter(
    (m) => m.periodStart >= periodStart && m.periodStart <= periodEnd
  );

  // 获取日记和知识库计数
  const allDiaries = await listDiaries({ offset: 0, limit: 200 });
  const weekDiaries = allDiaries.filter(
    (d) => d.createdAt >= `${periodStart}T00:00:00` && d.createdAt <= `${periodEnd}T23:59:59`
  );
  const allItems = await listItems();
  const weekItems = allItems.filter(
    (k) => k.createdAt >= `${periodStart}T00:00:00` && k.createdAt <= `${periodEnd}T23:59:59`
  );

  const data: WeeklyMindlogData = {
    weekStart: periodStart,
    weekEnd: periodEnd,
    dailyMindlogs: weekMindlogs.map((m) => ({
      keywords: m.keywords,
      content: m.content,
      date: m.periodStart,
    })),
    diaryCount: weekDiaries.length,
    knowledgeCount: weekItems.length,
  };

  return { periodStart, periodEnd, data };
}

async function aggregateMonthly(): Promise<{
  periodStart: string;
  periodEnd: string;
  data: MonthlyMindlogData;
}> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const periodStart = `${monthStr}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const periodEnd = `${monthStr}-${String(lastDay).padStart(2, '0')}`;

  // 获取本月 weekly mindlogs
  const weeklyMindlogs = await listByType('weekly', 5);
  const monthWeeklies = weeklyMindlogs.filter(
    (m) => m.periodStart >= periodStart && m.periodStart <= periodEnd
  );

  // 统计
  const allDiaries = await listDiaries({ offset: 0, limit: 500 });
  const monthDiaries = allDiaries.filter(
    (d) => d.createdAt >= `${periodStart}T00:00:00` && d.createdAt <= `${periodEnd}T23:59:59`
  );
  const allItems = await listItems();
  const monthItems = allItems.filter(
    (k) => k.createdAt >= `${periodStart}T00:00:00` && k.createdAt <= `${periodEnd}T23:59:59`
  );
  const creationCount = monthItems.filter((k) => k.type === 'creation_article').length;

  const data: MonthlyMindlogData = {
    month: monthStr,
    weeklyMindlogs: monthWeeklies.map((m) => ({
      keywords: m.keywords,
      content: m.content,
      weekStart: m.periodStart,
    })),
    diaryCount: monthDiaries.length,
    knowledgeCount: monthItems.length,
    creationCount,
  };

  return { periodStart, periodEnd, data };
}

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

function extractPreview(rawText: string): string {
  // AI 输出是 JSON，尝试提取可读内容展示
  // 先尝试提取 content 字段
  const contentMatch = rawText.match(/"content"\s*:\s*"([\s\S]*)/);
  if (contentMatch) {
    let preview = contentMatch[1];
    preview = preview.replace(/"\s*,?\s*"dashboardSummary[\s\S]*$/, '');
    preview = preview.replace(/"\s*}\s*$/, '');
    try {
      preview = JSON.parse(`"${preview}"`);
    } catch {
      preview = preview
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    }
    return preview;
  }
  // 如果还没到 content 字段，尝试展示 keywords
  const kwMatch = rawText.match(/"keywords"\s*:\s*"([^"]+)"/);
  if (kwMatch) {
    return `关键词：${kwMatch[1]}`;
  }
  return '';
}

function extractJSON(text: string): { keywords?: string; content?: string; dashboardSummary?: string } | null {
  try {
    return JSON.parse(text);
  } catch {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    try {
      return JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        try {
          return JSON.parse(cleaned.slice(start, end + 1));
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}

function getSourceDiaryCount(data: DailyMindlogData | WeeklyMindlogData | MonthlyMindlogData): number {
  if ('diaries' in data) return data.diaries.length;
  if ('diaryCount' in data) return data.diaryCount;
  return 0;
}

function getSourceKnowledgeCount(data: DailyMindlogData | WeeklyMindlogData | MonthlyMindlogData): number {
  if ('knowledgeOps' in data) return data.knowledgeOps.length;
  if ('knowledgeCount' in data) return data.knowledgeCount;
  return 0;
}
