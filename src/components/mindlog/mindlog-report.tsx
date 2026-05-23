'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { listByType, type MindLogEntry } from '@/lib/storage/mindlog-store';

interface MindlogReportProps {
  onBack: () => void;
  onGenerate: (type: 'daily' | 'weekly' | 'monthly') => void;
}

const TABS: { key: MindLogEntry['type']; label: string }[] = [
  { key: 'daily', label: '每日' },
  { key: 'weekly', label: '每周' },
  { key: 'monthly', label: '每月' },
];

export function MindlogReport({ onBack, onGenerate }: MindlogReportProps) {
  const [activeTab, setActiveTab] = useState<MindLogEntry['type']>('daily');
  const [entries, setEntries] = useState<MindLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEntries(activeTab);
  }, [activeTab]);

  async function loadEntries(type: MindLogEntry['type']) {
    setLoading(true);
    try {
      const list = await listByType(type, 10);
      setEntries(list);
    } catch (e) {
      console.error('Failed to load mindlog entries:', e);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="space-y-8"
    >
      {/* 返回按钮 */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50/80 transition-colors duration-200"
      >
        <ArrowLeft size={16} strokeWidth={1.5} />
        返回
      </button>

      {/* Tab 切换 */}
      <div className="border-b border-gray-100 flex gap-8">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-3 text-sm transition-colors duration-200 ${
              activeTab === tab.key
                ? 'text-gray-800 border-b-2 border-teal-400'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="space-y-8"
        >
          {loading ? (
            <LoadingSkeleton />
          ) : entries.length === 0 ? (
            <EmptyState type={activeTab} onGenerate={() => onGenerate(activeTab)} />
          ) : (
            entries.map((entry) => (
              <MindlogCard key={entry.id} entry={entry} />
            ))
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

// ─── 单条 MindLog 卡片 ─────────────────────────────────────────────────────

function MindlogCard({ entry }: { entry: MindLogEntry }) {
  const sections = parseContent(entry.content);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="bg-white/60 backdrop-blur-sm border border-black/5 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
    >
      {/* 关键词标题 */}
      <h3 className="text-xl font-light tracking-wider text-gray-800 mb-2">
        {entry.keywords}
      </h3>
      <span className="text-sm italic text-gray-400 opacity-70">
        {entry.periodStart}{entry.periodEnd !== entry.periodStart ? ` ~ ${entry.periodEnd}` : ''}
      </span>

      {/* 结构化内容 */}
      <div className="mt-6 space-y-5">
        {sections.map((section, i) => (
          <div key={i}>
            {section.title && (
              <p className="text-sm font-medium text-gray-500 mb-1">
                {section.title}
              </p>
            )}
            <p className={`text-[15px] leading-[1.8] text-gray-600 ${
              section.title?.includes('迭代微词') ? 'italic text-sm text-gray-400 opacity-70' : ''
            }`}>
              {section.body}
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── 内容解析 ─────────────────────────────────────────────────────────────

interface ContentSection {
  title: string;
  body: string;
}

function parseContent(content: string): ContentSection[] {
  // content 使用 **bold** 标记板块标题
  const sections: ContentSection[] = [];
  const lines = content.split('\n');

  let currentTitle = '';
  let currentBody: string[] = [];

  for (const line of lines) {
    const titleMatch = line.match(/^\*\*(.+?)\*\*[：:]\s*(.*)/);
    const titleOnlyMatch = line.match(/^\*\*(.+?)\*\*\s*$/);

    if (titleMatch) {
      // 保存上一段
      if (currentTitle || currentBody.length > 0) {
        sections.push({ title: currentTitle, body: currentBody.join('\n').trim() });
      }
      currentTitle = titleMatch[1];
      currentBody = titleMatch[2] ? [titleMatch[2]] : [];
    } else if (titleOnlyMatch) {
      if (currentTitle || currentBody.length > 0) {
        sections.push({ title: currentTitle, body: currentBody.join('\n').trim() });
      }
      currentTitle = titleOnlyMatch[1];
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }

  // 保存最后一段
  if (currentTitle || currentBody.length > 0) {
    sections.push({ title: currentTitle, body: currentBody.join('\n').trim() });
  }

  return sections.filter((s) => s.body.length > 0);
}

// ─── 空状态 ─────────────────────────────────────────────────────────────────

function EmptyState({ type, onGenerate }: { type: string; onGenerate: () => void }) {
  const emptyMessages: Record<string, string> = {
    daily: '足迹未落，来日方长',
    weekly: '一周的光还在路上',
    monthly: '时间会替你写下注脚',
  };

  const typeLabels: Record<string, string> = {
    daily: '每日',
    weekly: '每周',
    monthly: '每月',
  };

  return (
    <div className="py-12 text-center space-y-6">
      <p className="text-[15px] leading-[1.8] text-gray-400">
        {emptyMessages[type] || `暂无${typeLabels[type]}心智日志`}
      </p>
      <button
        onClick={onGenerate}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-normal text-teal-700 bg-teal-50/80 hover:bg-teal-100/90 transition-colors duration-200"
      >
        <Sparkles size={16} strokeWidth={1.5} />
        生成{typeLabels[type]}心智总结
      </button>
    </div>
  );
}

// ─── 加载骨架 ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {[1, 2].map((i) => (
        <div key={i} className="bg-white/40 rounded-2xl p-6 space-y-4">
          <div className="h-6 w-40 bg-gray-100 rounded" />
          <div className="h-4 w-24 bg-gray-50 rounded" />
          <div className="space-y-2">
            <div className="h-4 w-full bg-gray-50 rounded" />
            <div className="h-4 w-3/4 bg-gray-50 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
