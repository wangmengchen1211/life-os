'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, Link2, FileText, File, PenTool, Plus, GitBranch, CheckSquare, Trash2, ChevronLeft, ChevronRight, RefreshCw, X } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCard } from '@/components/ui/skeleton';
import { listItems, searchItems, listCategories, deleteItem, getItem, getTaggingContext, type KnowledgeItem } from '@/lib/storage/knowledge-store';
import { triggerAITagging } from '@/lib/ai/tagging';
import { safeText } from '@/lib/utils/safe-text';
import KnowledgeSourceView from './knowledge-source-view';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ListState {
  viewMode: ViewMode;
  selectedCategory: string | null;
  scrollTop: number;
}

interface KnowledgeListProps {
  onSelectItem?: (id: number) => void;
  onCapture?: () => void;
  onViewGraph?: () => void;
  onStateCapture?: (state: ListState) => void;
  initialViewMode?: ViewMode;
  initialCategory?: string | null;
  initialScrollTop?: number;
}

type ViewMode = 'topic' | 'source' | 'time';
type FilterType = 'all' | 'link' | 'text' | 'file' | 'creation_article' | 'obsidian';

const VIEW_TABS: { key: ViewMode; label: string }[] = [
  { key: 'topic', label: '主题' },
  { key: 'source', label: '来源' },
  { key: 'time', label: '时间' },
];

const TYPE_TABS: { key: FilterType; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'link', label: '链接' },
  { key: 'text', label: '文本' },
  { key: 'file', label: '文件' },
  { key: 'creation_article', label: '创作' },
  { key: 'obsidian', label: 'Obsidian' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return '刚刚';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}个月前`;

  return `${Math.floor(months / 12)}年前`;
}

function getTypeIcon(type: KnowledgeItem['type']) {
  switch (type) {
    case 'link':
      return <Link2 size={16} className="text-teal-500" />;
    case 'text':
      return <FileText size={16} className="text-sky-500" />;
    case 'file':
      return <File size={16} className="text-amber-500" />;
    case 'creation_article':
      return <PenTool size={16} className="text-violet-500" />;
    case 'feishu':
      return <FileText size={16} className="text-indigo-500" />;
    case 'obsidian':
      return <FileText size={16} className="text-purple-500" />;
  }
}

// ─── Calendar Helpers ────────────────────────────────────────────────────────

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getCalendarDays(year: number, month: number): { date: Date; isCurrentMonth: boolean }[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay(); // 0=Sun
  const daysInMonth = lastDay.getDate();

  const days: { date: Date; isCurrentMonth: boolean }[] = [];

  // Fill leading days from prev month
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, isCurrentMonth: false });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true });
  }

  // Fill trailing days to complete 6 rows (42 cells) or at least complete the last row
  while (days.length % 7 !== 0) {
    const lastDate = days[days.length - 1].date;
    const next = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate() + 1);
    days.push({ date: next, isCurrentMonth: false });
  }

  return days;
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

// ─── TimeCalendarView ────────────────────────────────────────────────────────

interface TimeCalendarViewProps {
  timeItems: KnowledgeItem[];
  calendarMonth: Date;
  setCalendarMonth: (d: Date) => void;
  selectedDate: string | null;
  setSelectedDate: (d: string | null) => void;
  batchMode: boolean;
  selectedIds: Set<number>;
  toggleSelect: (id: number) => void;
  onSelectItem?: (id: number) => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onItemClick?: (id: number) => void;
}

function TimeCalendarView({
  timeItems,
  calendarMonth,
  setCalendarMonth,
  selectedDate,
  setSelectedDate,
  batchMode,
  selectedIds,
  toggleSelect,
  onSelectItem,
  scrollRef,
  onItemClick,
}: TimeCalendarViewProps) {
  const todayKey = toDateKey(new Date());

  // Build dateCountMap
  const dateCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of timeItems) {
      const key = toDateKey(new Date(item.createdAt));
      map[key] = (map[key] || 0) + 1;
    }
    return map;
  }, [timeItems]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    return getCalendarDays(calendarMonth.getFullYear(), calendarMonth.getMonth());
  }, [calendarMonth]);

  // Filtered items for display
  const displayItems = useMemo(() => {
    if (selectedDate) {
      return timeItems.filter((item) => toDateKey(new Date(item.createdAt)) === selectedDate);
    }
    // No date selected: show current month items
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    return timeItems.filter((item) => {
      const d = new Date(item.createdAt);
      return d.getFullYear() === y && d.getMonth() === m;
    });
  }, [timeItems, selectedDate, calendarMonth]);

  const goToPrevMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
    setSelectedDate(null);
  };

  const handleDateClick = (dateKey: string) => {
    setSelectedDate(selectedDate === dateKey ? null : dateKey);
  };

  if (timeItems.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <EmptyState
          icon={<FileText size={48} strokeWidth={1} />}
          title="知识库是空的"
          description="开始收录第一条知识吧"
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col gap-3" ref={scrollRef}>
      {/* Calendar */}
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={goToPrevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-900 hover:bg-black/5 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-gray-700">
            {calendarMonth.getFullYear()}年{calendarMonth.getMonth() + 1}月
          </span>
          <button
            onClick={goToNextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-900 hover:bg-black/5 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="text-center text-[10px] text-gray-400 py-1">
              {label}
            </div>
          ))}
        </div>

        {/* Date Grid */}
        <div className="grid grid-cols-7 gap-px">
          {calendarDays.map(({ date, isCurrentMonth }, idx) => {
            const dateKey = toDateKey(date);
            const isToday = dateKey === todayKey;
            const isSelected = dateKey === selectedDate;
            const hasItems = (dateCountMap[dateKey] || 0) > 0;

            return (
              <button
                key={idx}
                onClick={() => isCurrentMonth && handleDateClick(dateKey)}
                className={`relative flex flex-col items-center justify-center py-1.5 rounded-lg text-xs transition-all duration-150 ${
                  !isCurrentMonth
                    ? 'text-gray-300 cursor-default'
                    : isSelected
                    ? 'bg-teal-500 text-white'
                    : isToday
                    ? 'text-gray-700 ring-1 ring-teal-400'
                    : 'text-gray-700 hover:bg-black/5'
                }`}
              >
                <span className="leading-none">{date.getDate()}</span>
                {hasItems && isCurrentMonth && !isSelected && (
                  <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-teal-500" />
                )}
                {hasItems && isCurrentMonth && isSelected && (
                  <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-white" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected date label */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs text-gray-500">
          {selectedDate
            ? `${selectedDate} 的条目 (${displayItems.length})`
            : `${calendarMonth.getFullYear()}年${calendarMonth.getMonth() + 1}月 共 ${displayItems.length} 条`}
        </span>
        {selectedDate && (
          <button
            onClick={() => setSelectedDate(null)}
            className="text-[10px] text-teal-600 hover:text-teal-800 transition-colors"
          >
            查看全月
          </button>
        )}
      </div>

      {/* Items */}
      {displayItems.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-400">该日期暂无条目</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayItems.map((item) => {
            const isSelected = item.id != null && selectedIds.has(item.id);
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (batchMode) {
                    if (item.id != null) toggleSelect(item.id);
                  } else {
                    if (item.id) {
                      onItemClick ? onItemClick(item.id) : onSelectItem?.(item.id);
                    }
                  }
                }}
                className={`w-full text-left bg-white/60 backdrop-blur-sm rounded-xl p-3 transition-all duration-200 hover:bg-white/80 hover:shadow-sm ${
                  batchMode && isSelected ? 'ring-2 ring-teal-400/60 bg-teal-50/30' : ''
                }`}
              >
                <div className="flex items-start gap-2.5">
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
                  <div className="w-8 h-8 rounded-lg bg-white/80 flex items-center justify-center shrink-0 mt-0.5">
                    {getTypeIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {safeText(item.title)}
                    </h4>
                    {item.aiSummary && (
                      <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                        {safeText(item.aiSummary)}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      {item.topicTags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 text-[10px] rounded bg-teal-50/80 text-teal-700"
                        >
                          {tag}
                        </span>
                      ))}
                      <span className="text-[10px] ml-auto" style={{ color: 'var(--text-secondary)' }}>
                        {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function KnowledgeList({ onSelectItem, onCapture, onViewGraph, onStateCapture, initialViewMode, initialCategory, initialScrollTop }: KnowledgeListProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode || 'topic');
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [timeItems, setTimeItems] = useState<KnowledgeItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeType, setActiveType] = useState<FilterType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory ?? null);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll refs for position restoration
  const topicScrollRef = useRef<HTMLDivElement>(null);
  const timeScrollRef = useRef<HTMLDivElement>(null);
  const scrollRestoredRef = useRef(false);

  // Calendar state for time view
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Batch mode state
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [retagProgress, setRetagProgress] = useState<{ current: number; total: number } | null>(null);

  // Load items
  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      let result: KnowledgeItem[];

      if (searchQuery.trim()) {
        result = await searchItems(searchQuery, {
          type: activeType === 'all' ? undefined : activeType,
        });
      } else {
        result = await listItems({
          type: activeType === 'all' ? undefined : activeType,
        });
      }

      // Filter by selected primary category
      if (selectedCategory) {
        result = result.filter((item) => item.primaryCategory === selectedCategory);
      }

      setItems(result);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, activeType, selectedCategory]);

  // Load primary categories
  useEffect(() => {
    (async () => {
      const categories = await listCategories();
      setAllCategories(categories.map((c) => c.name));
    })();
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadItems();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [loadItems]);

  // Load time-sorted items for time view
  useEffect(() => {
    if (viewMode === 'time') {
      (async () => {
        const all = await listItems();
        setTimeItems(all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      })();
    }
  }, [viewMode]);

  const selectCategory = (cat: string | null) => {
    setSelectedCategory((prev) => (prev === cat ? null : cat));
  };

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
    const currentItems = viewMode === 'time' ? timeItems : items;
    const allIds = new Set(currentItems.filter((i) => i.id != null).map((i) => i.id!));
    setSelectedIds(allIds);
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(`确认删除 ${selectedIds.size} 条知识条目？此操作不可撤销。`);
    if (!confirmed) return;

    setDeleting(true);
    try {
      for (const id of selectedIds) {
        await deleteItem(id);
      }
      await loadItems();
      exitBatchMode();
    } catch (e) {
      console.error('批量删除失败:', e);
    } finally {
      setDeleting(false);
    }
  };

  const handleBatchRetag = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setRetagProgress({ current: 0, total: ids.length });

    try {
      const context = await getTaggingContext();
      for (let i = 0; i < ids.length; i++) {
        setRetagProgress({ current: i + 1, total: ids.length });
        const item = await getItem(ids[i]);
        if (!item) continue;
        await triggerAITagging(ids[i], item.title, item.rawContent || '', context);
      }
      await loadItems();
    } catch (e) {
      console.error('批量重新解析失败:', e);
    } finally {
      setRetagProgress(null);
    }
  };

  // Capture current state for position restoration
  const captureState = useCallback((): ListState => {
    const scrollEl = viewMode === 'time' ? timeScrollRef.current : topicScrollRef.current;
    return {
      viewMode,
      selectedCategory,
      scrollTop: scrollEl?.scrollTop || 0,
    };
  }, [viewMode, selectedCategory]);

  // Restore scroll position after items loaded
  useEffect(() => {
    if (initialScrollTop && !scrollRestoredRef.current && !loading && items.length > 0) {
      scrollRestoredRef.current = true;
      requestAnimationFrame(() => {
        const scrollEl = viewMode === 'time' ? timeScrollRef.current : topicScrollRef.current;
        scrollEl?.scrollTo(0, initialScrollTop);
      });
    }
  }, [loading, items, initialScrollTop, viewMode]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="relative h-full flex flex-col">
      {/* View Mode Tabs + Batch Button */}
      <div className="flex items-center mb-2">
        <div className="flex gap-1 p-0.5 bg-black/5 rounded-xl w-fit">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setViewMode(tab.key)}
              className={`px-4 py-1.5 text-xs rounded-lg transition-all duration-200 ${
                viewMode === tab.key
                  ? 'bg-white/70 text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {!batchMode && (
          <button
            onClick={enterBatchMode}
            disabled={viewMode === 'source'}
            className={`ml-auto px-2.5 py-1.5 text-xs rounded-lg transition-all duration-200 flex items-center gap-1 ${
              viewMode === 'source'
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-500 hover:text-gray-700 hover:bg-black/5'
            }`}
            title="批量管理"
          >
            <CheckSquare size={14} />
            <span>批量</span>
          </button>
        )}
      </div>


      {/* Source View */}
      {viewMode === 'source' && (
        <div className="flex-1 overflow-y-auto">
          <KnowledgeSourceView
            onSelectItem={(id) => {
              onStateCapture?.({ viewMode: 'source', selectedCategory: null, scrollTop: 0 });
              onSelectItem?.(id);
            }}
          />
        </div>
      )}

      {/* Time View */}
      {viewMode === 'time' && (
        <TimeCalendarView
          timeItems={timeItems}
          calendarMonth={calendarMonth}
          setCalendarMonth={setCalendarMonth}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          batchMode={batchMode}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          onSelectItem={onSelectItem}
          scrollRef={timeScrollRef}
          onItemClick={(id) => {
            onStateCapture?.(captureState());
            onSelectItem?.(id);
          }}
        />
      )}

      {/* Topic View (default) */}
      {viewMode === 'topic' && (<>
      {/* Header: Search + Graph Button */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索知识..."
            className="w-full rounded-xl bg-white/50 border border-white/60 pl-8 pr-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] transition-colors"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
        <button
          onClick={onViewGraph}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/50 border border-white/60 shrink-0"
          title="思维蛛网"
        >
          <GitBranch size={14} className="text-teal-600" />
        </button>
      </div>

      {/* Type Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1.5 mb-1.5 scrollbar-hide">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveType(tab.key)}
            className={`px-3 py-1 text-xs rounded-lg whitespace-nowrap transition-colors flex-shrink-0 ${
              activeType === tab.key
                ? 'bg-[var(--accent)] text-white'
                : 'bg-white/50 text-[var(--text-secondary)] hover:bg-white/70'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Category Chips — 横排可滚动 */}
      {allCategories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide whitespace-nowrap pb-2 mb-2">
          <button
            onClick={() => selectCategory(null)}
            className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-full transition-colors ${
              selectedCategory === null
                ? 'bg-teal-100 text-teal-800 ring-1 ring-teal-300'
                : 'bg-teal-50/80 text-teal-700 hover:bg-teal-100/80'
            }`}
          >
            全部
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => selectCategory(cat)}
              className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-full transition-colors ${
                selectedCategory === cat
                  ? 'bg-teal-100 text-teal-800 ring-1 ring-teal-300'
                  : 'bg-teal-50/80 text-teal-700 hover:bg-teal-100/80'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto" ref={topicScrollRef}>
        {loading ? (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<FileText size={48} strokeWidth={1} />}
            title="知识库是空的"
            description="开始收录第一条知识吧"
          />
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const isSelected = item.id != null && selectedIds.has(item.id);
              return (
              <button
                key={item.id}
                onClick={() => {
                  if (batchMode) {
                    if (item.id != null) toggleSelect(item.id);
                  } else {
                    if (item.id) {
                      onStateCapture?.(captureState());
                      onSelectItem?.(item.id);
                    }
                  }
                }}
                className={`w-full text-left bg-white/60 backdrop-blur-sm rounded-xl p-3 transition-all hover:bg-white/80 hover:shadow-sm ${
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

                  {/* Type Icon */}
                  <div className="w-8 h-8 rounded-lg bg-white/80 flex items-center justify-center shrink-0 mt-0.5">
                    {getTypeIcon(item.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {safeText(item.title)}
                    </h4>

                    {item.aiSummary && (
                      <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                        {safeText(item.aiSummary)}
                      </p>
                    )}

                    {/* Tags + Time */}
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex gap-1 flex-wrap">
                        {item.topicTags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 text-[10px] rounded bg-teal-50/80 text-teal-700"
                          >
                            {tag}
                          </span>
                        ))}
                        {item.topicTags.length > 3 && (
                          <span className="text-[10px] text-gray-400">
                            +{item.topicTags.length - 3}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] shrink-0 ml-2" style={{ color: 'var(--text-secondary)' }}>
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
              );
            })}
          </div>
        )}
      </div>

      </>)}

      {/* Batch Mode Toolbar - Bottom */}
      {batchMode && (
        <div className="sticky bottom-0 left-0 right-0 flex items-center gap-2 px-3 py-2 mt-2 bg-white/90 backdrop-blur-sm rounded-t-xl shadow-[0_-2px_8px_rgba(0,0,0,0.06)] border-t border-teal-100/60 z-10">
          <span className="text-xs text-gray-600 font-medium whitespace-nowrap">
            已选 <span className="text-teal-600 font-semibold">{selectedIds.size}</span>
          </span>
          <button
            onClick={() => {
              const currentItems = viewMode === 'time' ? timeItems : items;
              const allIds = currentItems.filter((i) => i.id != null).map((i) => i.id!);
              selectedIds.size >= allIds.length ? deselectAll() : selectAll();
            }}
            className="px-2 py-0.5 text-xs rounded-lg bg-black/5 text-gray-600 hover:bg-black/10 transition-colors whitespace-nowrap"
          >
            {(() => {
              const currentItems = viewMode === 'time' ? timeItems : items;
              const total = currentItems.filter((i) => i.id != null).length;
              return selectedIds.size >= total && selectedIds.size > 0 ? '反选' : '全选';
            })()}
          </button>
          <button
            onClick={handleBatchRetag}
            disabled={selectedIds.size === 0 || retagProgress !== null}
            className="p-1 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            title="重新解析"
          >
            <RefreshCw size={13} className={retagProgress ? 'animate-spin' : ''} />
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

      {/* FAB - New Capture */}
      {!batchMode && (
        <button
          onClick={onCapture}
          className="absolute bottom-6 right-6 w-12 h-12 bg-[var(--accent)] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform"
        >
          <Plus size={22} />
        </button>
      )}
    </div>
  );
}
