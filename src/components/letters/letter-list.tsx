'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail } from 'lucide-react';
import { listLetters, getLetterByMonth, type Letter } from '@/lib/storage/letter-store';
import { EmptyState } from '@/components/ui/empty-state';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LetterListProps {
  onSelectLetter?: (id: number) => void;
  onGenerate?: () => void;
  refreshKey?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMonth(periodMonth: string): string {
  const [year, month] = periodMonth.split('-');
  return `${year}年${parseInt(month)}月`;
}

function getCurrentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LetterList({ onSelectLetter, onGenerate, refreshKey }: LetterListProps) {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasCurrentMonth, setHasCurrentMonth] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [allLetters, currentMonthLetter] = await Promise.all([
          listLetters(),
          getLetterByMonth(getCurrentMonth()),
        ]);
        if (!cancelled) {
          setLetters(allLetters);
          setHasCurrentMonth(!!currentMonthLetter);
        }
      } catch (err) {
        console.error('Failed to load letters:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>加载中...</span>
      </div>
    );
  }

  if (letters.length === 0) {
    return (
      <div className="flex flex-col items-center h-full">
        <EmptyState
          icon={<Mail size={36} strokeWidth={1} />}
          title="还没有收到信件"
          description="生成你的第一封月度信吧"
        />
        <button
          onClick={onGenerate}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-100/80 to-orange-100/80 border border-amber-200/60 rounded-xl text-sm font-medium transition-all hover:shadow-sm active:scale-95"
          style={{ color: 'var(--text-primary)' }}
        >
          <Mail size={16} className="text-amber-500" />
          生成本月信件
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-full overflow-y-auto"
    >
      {/* Generate button area */}
      {!hasCurrentMonth && (
        <button
          onClick={onGenerate}
          className="flex items-center gap-3 bg-gradient-to-r from-amber-100/80 to-orange-100/80 border border-amber-200/60 rounded-xl p-4 mb-4 transition-all hover:shadow-sm active:scale-[0.98]"
        >
          <Mail size={20} className="text-amber-500" />
          <div className="text-left">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              生成本月信件
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              回顾这个月的点滴
            </p>
          </div>
        </button>
      )}

      {/* Letter list */}
      <div className="space-y-2">
        {letters.map((letter, index) => (
          <motion.button
            key={letter.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.05 }}
            onClick={() => letter.id && onSelectLetter?.(letter.id)}
            className="w-full text-left flex items-center gap-3 bg-white/60 backdrop-blur-sm border border-white/80 rounded-lg p-3 hover:bg-white/80 transition-all"
          >
            <div className="shrink-0 w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center">
              <Mail size={16} className="text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {letter.title}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {formatMonth(letter.periodMonth)}
              </p>
              <p
                className="text-xs mt-0.5 line-clamp-1"
                style={{ color: 'var(--text-secondary)', opacity: 0.7 }}
              >
                {letter.content}
              </p>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
