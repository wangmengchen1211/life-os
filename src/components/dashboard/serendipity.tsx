'use client';
import { useState, useEffect } from 'react';
import { listEntries } from '@/lib/storage/diary-store';
import { motion } from 'framer-motion';

interface SerendipityProps {
  onDismiss: () => void;
}

export function Serendipity({ onDismiss }: SerendipityProps) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function analyze() {
      try {
        const all = await listEntries();

        // 统计本周日记
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1);
        weekStart.setHours(0, 0, 0, 0);

        const weekEntries = all.filter((e: any) => {
          const d = new Date(e.createdAt || e.date);
          return d >= weekStart;
        });

        if (weekEntries.length === 0) {
          setMessage(null); // 无数据不触发
          return;
        }

        // 简单词频统计（中文分词简化版：按2-4字切割高频词）
        const allText = weekEntries.map((e: any) => e.content || '').join(' ');
        const words: Record<string, number> = {};
        // 提取中文词汇（2-4字）
        const matches = allText.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
        const stopWords = new Set(['的是', '了在', '不是', '没有', '可以', '就是', '这个', '那个', '已经', '什么', '一个', '我们', '他们', '自己', '知道', '觉得', '因为', '所以', '但是', '如果', '虽然', '还是', '或者', '而且']);
        matches.forEach(w => {
          if (!stopWords.has(w)) {
            words[w] = (words[w] || 0) + 1;
          }
        });

        const sorted = Object.entries(words).sort((a, b) => b[1] - a[1]);
        const topWord = sorted[0]?.[0];

        if (topWord) {
          setMessage(`你最近一周写了 ${weekEntries.length} 篇日记，提到最多的词是「${topWord}」。`);
        } else {
          setMessage(`你最近一周写了 ${weekEntries.length} 篇日记，继续记录吧。`);
        }
      } catch {
        setMessage(null);
      }
    }
    analyze();
  }, []);

  if (!message) return null;

  return (
    <motion.div
      className="py-8 space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <p className="text-lg font-light leading-loose tracking-wide text-amber-700/60">
        {message}
      </p>
      <button
        onClick={onDismiss}
        className="text-sm italic text-gray-400 opacity-60 hover:opacity-100 transition-opacity"
      >
        好的，让我看看今天的心智
      </button>
    </motion.div>
  );
}

// Helper: 检查是否应该触发意外层
export function shouldShowSerendipity(): boolean {
  if (typeof window === 'undefined') return false;
  const key = 'mindos-visit-count';
  const count = parseInt(localStorage.getItem(key) || '0', 10) + 1;
  localStorage.setItem(key, String(count));
  return count % 10 === 0 && count > 0;
}
