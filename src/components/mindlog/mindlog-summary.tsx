'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { getWeekCount } from '@/lib/storage/diary-store';
import { getStats } from '@/lib/storage/knowledge-store';
import { getWeekTodos } from '@/lib/storage/todo-store';
import { getLatestByType } from '@/lib/storage/mindlog-store';

interface MindlogSummaryProps {
  onViewReport: () => void;
  onGenerate: () => void;
}

export function MindlogSummary({ onViewReport, onGenerate }: MindlogSummaryProps) {
  const router = useRouter();
  const [diaryCount, setDiaryCount] = useState<number>(0);
  const [knowledgeCount, setKnowledgeCount] = useState<number>(0);
  const [todoCompleted, setTodoCompleted] = useState<number>(0);
  const [topWord, setTopWord] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadStats() {
      try {
        const [diaryWeek, knowledgeStats, weekTodos, latestMindlog] = await Promise.all([
          getWeekCount().catch(() => 0),
          getStats().catch(() => ({ totalItems: 0 })),
          getWeekTodos().catch(() => []),
          getLatestByType('daily').catch(() => undefined),
        ]);

        if (isMounted) {
          setDiaryCount(diaryWeek);
          setKnowledgeCount(knowledgeStats.totalItems);
          setTodoCompleted(weekTodos.filter((t: { isCompleted: boolean }) => t.isCompleted).length);

          // 从最新心智日志提取关键词（格式如 "灰调·重连"）
          if (latestMindlog?.keywords) {
            setTopWord(latestMindlog.keywords.split('·')[0].trim());
          }
        }
      } catch (err) {
        console.error('MindLog stats load failed:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadStats();
    return () => { isMounted = false; };
  }, []);

  // 加载中：诗意等待提示
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        className="py-2"
      >
        <p className="text-sm italic text-[var(--color-text-muted)]">
          正在整理你的记录…
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.1 }}
      className="py-2 space-y-2"
    >
      {/* 一周统计摘要 */}
      <p className="text-sm font-light leading-relaxed text-gray-500">
        你最近一周写了<span className="text-gray-700 font-normal">{diaryCount}</span>篇日记，记录了<span className="text-gray-700 font-normal">{knowledgeCount}</span>条思维，完成了<span className="text-gray-700 font-normal">{todoCompleted}</span>项待办{topWord ? <>{'，提到最多的词是「'}<span className="text-teal-700 font-normal cursor-pointer hover:text-teal-500 transition-colors" onClick={() => router.push(`/mindlog/keyword/${encodeURIComponent(topWord)}`)}>{topWord}</span>{'」'}</> : null}
      </p>

      {/* 心智日志入口 */}
      <button
        onClick={onViewReport}
        className="text-sm font-light text-teal-600 opacity-60 hover:opacity-100 transition-opacity duration-300"
      >
        好的，让我看看今日的心智日志 →
      </button>
    </motion.div>
  );
}
