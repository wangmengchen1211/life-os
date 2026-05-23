'use client';
import { useState, useEffect } from 'react';
import { listEntries } from '@/lib/storage/diary-store';
import { motion } from 'framer-motion';

// 今日回响：把今日日记内容交给 AI，按严格规则精选一句原话。
// 为节省费用，同一天 + 同一份内容只调一次 AI，结果缓存在 localStorage。
// cache key: daily-echo:<YYYY-MM-DD>:<contentHash>

const FALLBACK_QUIET = '今天的文字是平静的——也许有些感触正在水面下酝酿';

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return String(h >>> 0);
}

export function DailyEcho() {
  const [quote, setQuote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTodayEcho() {
      try {
        const all = await listEntries();
        const today = new Date().toISOString().slice(0, 10);
        const todayEntries = all.filter(
          (e: { createdAt?: string; date?: string }) =>
            e.createdAt?.slice?.(0, 10) === today ||
            e.date?.slice?.(0, 10) === today
        );

        if (todayEntries.length === 0) {
          if (!cancelled) setQuote('今天还没有留下痕迹，但空白本身也是一种语言。');
          return;
        }

        const diaries = todayEntries
          .map((e: { content?: string }) => (e.content || '').trim())
          .filter((s: string) => s.length > 0);

        if (diaries.length === 0) {
          if (!cancelled) setQuote('今天还没有留下痕迹，但空白本身也是一种语言。');
          return;
        }

        const contentHash = simpleHash(diaries.join('\n\n'));
        const cacheKey = `daily-echo:${today}:${contentHash}`;

        // 命中缓存直接显示
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            if (!cancelled) setQuote(cached);
            return;
          }
        } catch {
          // localStorage 不可用时忽略
        }

        // 未命中 → 调 AI
        const resp = await fetch('/api/daily-echo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ diaries }),
        });

        if (!resp.ok) {
          if (!cancelled) setQuote(FALLBACK_QUIET);
          return;
        }

        const data = (await resp.json()) as { echo?: string };
        const echo = (data.echo || '').trim() || FALLBACK_QUIET;

        try {
          localStorage.setItem(cacheKey, echo);
        } catch {
          // 忽略写缓存失败
        }

        if (!cancelled) setQuote(echo);
      } catch {
        if (!cancelled) setQuote(FALLBACK_QUIET);
      }
    }

    loadTodayEcho();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!quote) return null;

  return (
    <motion.div
      className="mt-3 pt-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.8 }}
    >
      {/* 极淡渐变分隔线 */}
      <div className="h-px bg-gradient-to-r from-transparent via-gray-200/40 to-transparent mb-2" />
      <p className="text-[13px] italic text-left leading-relaxed" style={{ color: '#b0a8a0' }}>
        {quote}
      </p>
    </motion.div>
  );
}
