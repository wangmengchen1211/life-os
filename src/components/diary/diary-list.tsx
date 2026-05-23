'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronLeft, ChevronRight, PenLine, Trash2, X } from 'lucide-react';
import { listEntries, deleteEntry, type DiaryEntry } from '@/lib/storage/diary-store';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCard } from '@/components/ui/skeleton';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DiaryListProps {
  onSelectEntry?: (id: number) => void;
  onWrite?: () => void;
  refreshKey?: number;
}

// ─── Mood color mapping ──────────────────────────────────────────────────────

function getMoodColor(mood: string): string {
  const happyMoods = ['开心', '兴奋', '快乐', '幸福'];
  const calmMoods = ['平静', '感恩', '释然', '满足', '放松'];
  const tiredMoods = ['疲惫', '焦虑', '难过', '低落', '压力', '烦躁', '沮丧'];
  const thinkMoods = ['思考', '期待', '好奇', '专注'];

  if (happyMoods.includes(mood)) return 'bg-purple-400';
  if (calmMoods.includes(mood)) return 'bg-teal-400';
  if (tiredMoods.includes(mood)) return 'bg-amber-400';
  if (thinkMoods.includes(mood)) return 'bg-blue-400';
  return 'bg-slate-300';
}

// ─── Calendar helpers ────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  // 0=Sunday, convert so Monday=0
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

// ─── Component ───────────────────────────────────────────────────────────────

export default function DiaryList({ onSelectEntry, onWrite, refreshKey }: DiaryListProps) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Batch mode state
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Load function for reuse
  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const allEntries = await listEntries();
      const monthEntries = allEntries.filter((entry) => {
        const d = new Date(entry.createdAt);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      });
      setEntries(monthEntries);
    } catch (err) {
      console.error('Failed to load diary entries:', err);
    } finally {
      setLoading(false);
    }
  }, [currentYear, currentMonth]);

  // Load entries for current month
  useEffect(() => {
    loadEntries();
  }, [loadEntries, refreshKey]);

  // Batch mode handlers
  const enterBatchMode = () => {
    setBatchMode(true);
    setSelectedIds(new Set());
  };

  const exitBatchMode = () => {
    setBatchMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    const allIds = new Set(entries.filter((e) => e.id != null).map((e) => e.id!));
    setSelectedIds(allIds);
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(`确认删除 ${selectedIds.size} 篇日记？此操作不可撤销。`);
    if (!confirmed) return;

    setDeleting(true);
    try {
      for (const id of selectedIds) {
        await deleteEntry(id);
      }
      await loadEntries();
      exitBatchMode();
    } catch (e) {
      console.error('批量删除失败:', e);
    } finally {
      setDeleting(false);
    }
  };

  // Navigate months
  const prevMonth = useCallback(() => {
    if (currentMonth === 0) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }, [currentMonth]);

  const nextMonth = useCallback(() => {
    if (currentMonth === 11) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }, [currentMonth]);

  // Map date -> entries for calendar
  const dateEntryMap = new Map<number, DiaryEntry[]>();
  entries.forEach((entry) => {
    const day = new Date(entry.createdAt).getDate();
    const existing = dateEntryMap.get(day) || [];
    existing.push(entry);
    dateEntryMap.set(day, existing);
  });

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOffset = getFirstDayOfWeek(currentYear, currentMonth);

  const isToday = (day: number) =>
    currentYear === today.getFullYear() &&
    currentMonth === today.getMonth() &&
    day === today.getDate();

  const handleDayClick = (day: number) => {
    const dayEntries = dateEntryMap.get(day);
    if (dayEntries && dayEntries.length > 0 && onSelectEntry) {
      onSelectEntry(dayEntries[0].id!);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="relative h-full flex flex-col overflow-hidden">

      {/* Calendar Section */}
      <div className="px-3 pt-2 pb-1">
        {/* Month navigation */}
        <div className="flex items-center mb-2">
          <button
            onClick={prevMonth}
            className="p-1 rounded-lg hover:bg-white/40 transition-colors"
            aria-label="上个月"
          >
            <ChevronLeft size={18} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <span className="flex-1 text-center text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {currentYear}年{currentMonth + 1}月
          </span>
          <button
            onClick={nextMonth}
            className="p-1 rounded-lg hover:bg-white/40 transition-colors"
            aria-label="下个月"
          >
            <ChevronRight size={18} style={{ color: 'var(--text-secondary)' }} />
          </button>
          {!batchMode && (
            <button
              onClick={enterBatchMode}
              className="ml-2 text-xs text-gray-400 hover:text-gray-500 transition-colors"
              title="批量管理"
            >
              批量
            </button>
          )}
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-0.5 mb-0.5">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="text-[10px] text-center py-0.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {/* Empty offset cells */}
          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="w-10 h-10" />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const hasEntry = dateEntryMap.has(day);
            const dayEntries = dateEntryMap.get(day) || [];
            const moodColor = dayEntries.length > 0 && dayEntries[0].moodTags.length > 0
              ? getMoodColor(dayEntries[0].moodTags[0])
              : '';

            return (
              <button
                key={day}
                onClick={() => handleDayClick(day)}
                className={`
                  relative w-9 h-9 rounded-lg flex items-center justify-center text-xs
                  transition-all duration-150
                  ${isToday(day) ? 'border-2 border-[var(--accent)] font-semibold' : ''}
                  ${hasEntry ? 'cursor-pointer hover:bg-white/50' : 'cursor-default'}
                `}
                style={{ color: 'var(--text-primary)' }}
                disabled={!hasEntry}
              >
                {day}
                {hasEntry && moodColor && (
                  <span
                    className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${moodColor}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* List Section */}
      <div className="flex-1 overflow-y-auto px-3 pb-20 mt-1">
        {loading ? (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<PenLine size={36} strokeWidth={1} />}
            title="还没有日记"
            description="还没有日记，开始记录今天的心情吧"
          />
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const date = new Date(entry.createdAt);
              const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;
              const isSelected = entry.id != null && selectedIds.has(entry.id);

              return (
                <button
                  key={entry.id}
                  onClick={() => {
                    if (batchMode) {
                      if (entry.id != null) toggleSelect(entry.id);
                    } else {
                      entry.id && onSelectEntry?.(entry.id);
                    }
                  }}
                  className={`w-full text-left bg-white/60 backdrop-blur-sm rounded-xl p-3.5 transition-all hover:bg-white/80 hover:shadow-sm ${
                    batchMode && isSelected ? 'ring-2 ring-teal-400/60 bg-teal-50/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Batch Checkbox */}
                    {batchMode && (
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-1 transition-all duration-150 ${
                        isSelected
                          ? 'bg-teal-500 border-teal-500'
                          : 'border-gray-300 bg-white/50'
                      }`}>
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs italic text-gray-400">
                          {dateStr}
                        </span>
                        {entry.moodTags.length > 0 && (
                          <div className="flex gap-1">
                            {entry.moodTags.slice(0, 3).map((mood) => (
                              <span
                                key={mood}
                                className="text-xs px-2.5 py-0.5 rounded-full bg-teal-50/50 text-teal-500/70"
                              >
                                {mood}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <p
                        className="text-base line-clamp-1 font-medium leading-relaxed mb-1"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {entry.content.split('\n')[0]}
                      </p>
                      {entry.content.split('\n').length > 1 && (
                        <p className="text-sm text-gray-500 line-clamp-1 leading-relaxed">
                          {entry.content.split('\n').slice(1).join(' ').trim()}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Batch Mode Toolbar - Bottom */}
      {batchMode && (
        <div className="sticky bottom-0 left-0 right-0 flex items-center gap-2 px-3 py-2 mt-2 bg-white/90 backdrop-blur-sm rounded-t-xl shadow-[0_-2px_8px_rgba(0,0,0,0.06)] border-t border-teal-100/60">
          <span className="text-xs text-gray-600 font-medium whitespace-nowrap">
            已选 <span className="text-teal-600 font-semibold">{selectedIds.size}</span>
          </span>
          <button
            onClick={() => {
              const allIds = entries.filter((e) => e.id != null).map((e) => e.id!);
              selectedIds.size >= allIds.length ? deselectAll() : selectAll();
            }}
            className="px-2 py-0.5 text-xs rounded-lg bg-black/5 text-gray-600 hover:bg-black/10 transition-colors whitespace-nowrap"
          >
            {selectedIds.size >= entries.filter((e) => e.id != null).length && selectedIds.size > 0 ? '反选' : '全选'}
          </button>
          <button
            onClick={handleBatchDelete}
            disabled={selectedIds.size === 0 || deleting}
            className="px-2 py-0.5 text-xs rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 whitespace-nowrap"
          >
            <Trash2 size={12} />
            {deleting ? '...' : '删除'}
          </button>
          <button
            onClick={exitBatchMode}
            className="ml-auto p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-black/5 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Floating write button */}
      {!batchMode && (
        <button
          onClick={onWrite}
          className="absolute bottom-4 right-4 bg-[var(--accent)] text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
          aria-label="写日记"
        >
          <Plus size={24} />
        </button>
      )}
    </div>
  );
}
