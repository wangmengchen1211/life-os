'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Trash2, Loader2 } from 'lucide-react';
import { getLetter, deleteLetter, type Letter } from '@/lib/storage/letter-store';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LetterDetailProps {
  letterId: number;
  onBack?: () => void;
  onDeleted?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPeriod(periodMonth: string): string {
  const [year, month] = periodMonth.split('-');
  return `${year}年${parseInt(month)}月 信件`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LetterDetail({ letterId, onBack, onDeleted }: LetterDetailProps) {
  const [letter, setLetter] = useState<Letter | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadLetter = useCallback(async () => {
    try {
      const data = await getLetter(letterId);
      if (data) setLetter(data);
    } finally {
      setLoading(false);
    }
  }, [letterId]);

  useEffect(() => {
    loadLetter();
  }, [loadLetter]);

  // ─── Delete handler ──────────────────────────────────────────────────────

  async function handleDelete() {
    try {
      await deleteLetter(letterId);
      onDeleted?.();
    } catch (err) {
      console.error('Failed to delete letter:', err);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (!letter) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-[var(--text-secondary)]">信件不存在</p>
        <button
          onClick={onBack}
          className="text-sm px-4 py-2 rounded-lg bg-white/60 backdrop-blur-sm hover:bg-white/80 transition-colors text-[var(--text-primary)]"
        >
          返回列表
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-full overflow-y-auto"
    >
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-white/40 transition-colors"
          aria-label="返回"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
        <button
          onClick={() => setConfirmDelete(true)}
          className="p-2 rounded-lg hover:bg-red-50 transition-colors"
          aria-label="删除"
        >
          <Trash2 className="w-4 h-4 text-red-400" />
        </button>
      </div>

      {/* ─── Delete Confirmation ────────────────────────────────────────────── */}
      {confirmDelete && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-4 p-3 rounded-xl bg-red-50/80 border border-red-100 flex items-center justify-between"
        >
          <span className="text-sm text-red-600">确定删除这封信吗？</span>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/80 text-[var(--text-secondary)] hover:bg-white transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleDelete}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              删除
            </button>
          </div>
        </motion.div>
      )}

      {/* ─── Letter Paper ───────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-b from-amber-50/40 via-orange-50/30 to-yellow-50/20 rounded-xl p-5">
        {/* Title */}
        <h2 className="text-lg font-medium text-[var(--text-primary)] mb-3">
          {letter.title}
        </h2>

        {/* Period */}
        <p className="text-xs text-[var(--text-secondary)] mb-4">
          {formatPeriod(letter.periodMonth)}
        </p>

        {/* Content */}
        <div className="whitespace-pre-wrap text-sm text-[var(--text-primary)] leading-relaxed">
          {letter.content}
        </div>

        {/* ─── Monthly Stats Card ──────────────────────────────────────────── */}
        <div className="bg-white/50 rounded-lg p-3 mt-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-medium text-amber-600">
              {letter.monthlyStats.diaryCount}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              篇日记
            </p>
          </div>
          <div>
            <p className="text-lg font-medium text-amber-600">
              {letter.monthlyStats.knowledgeCount}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              条知识
            </p>
          </div>
          <div>
            <p className="text-lg font-medium text-amber-600">
              {letter.monthlyStats.todoCompleted}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              项完成
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
