'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tags, FolderTree, X, Check, Plus, Pencil, ChevronDown } from 'lucide-react';
import {
  getTagStats,
  mergeTags,
  removeTag,
  listCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  type TopicCategory,
} from '@/lib/storage/knowledge-store';

// ─── Tag Management Section ──────────────────────────────────────────────────

function TagSection() {
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mergeTarget, setMergeTarget] = useState('');
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 200;

  const loadTags = useCallback(async () => {
    setLoading(true);
    try {
      const stats = await getTagStats();
      setTags(stats);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const toggleSelect = (tag: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const handleDelete = async (tag: string, count: number) => {
    const ok = window.confirm(`确认删除标签「${tag}」？将从 ${count} 条知识条目中移除。`);
    if (!ok) return;
    await removeTag(tag);
    setSelected(prev => {
      const next = new Set(prev);
      next.delete(tag);
      return next;
    });
    await loadTags();
  };

  const handleMerge = async () => {
    if (!mergeTarget.trim()) return;
    const selectedArr = Array.from(selected);
    const totalAffected = tags
      .filter(t => selected.has(t.tag))
      .reduce((sum, t) => sum + t.count, 0);

    const ok = window.confirm(
      `确认将 ${selectedArr.length} 个标签合并为「${mergeTarget.trim()}」？这将影响约 ${totalAffected} 条知识条目。`
    );
    if (!ok) return;

    await mergeTags(selectedArr, mergeTarget.trim());
    setSelected(new Set());
    setMergeTarget('');
    setShowMergeConfirm(false);
    await loadTags();
  };

  // Update default merge target when selection changes
  useEffect(() => {
    if (selected.size >= 2) {
      const best = tags
        .filter(t => selected.has(t.tag))
        .sort((a, b) => b.count - a.count)[0];
      if (best) setMergeTarget(best.tag);
      setShowMergeConfirm(true);
    } else {
      setShowMergeConfirm(false);
    }
  }, [selected, tags]);

  const totalPages = Math.ceil(tags.length / PAGE_SIZE);
  const visibleTags = tags.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (loading) {
    return <div className="h-20 bg-gray-100/60 animate-pulse rounded-lg" />;
  }

  if (tags.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">暂无标签数据</p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tag cloud */}
      <div className="flex flex-wrap gap-2">
        {visibleTags.map(({ tag, count }) => {
          const isLow = count < 3;
          const isSelected = selected.has(tag);
          return (
            <div
              key={tag}
              className={`group relative flex items-center gap-1 rounded-full px-3 py-1 text-sm cursor-pointer transition-all ${
                isSelected
                  ? 'bg-[#80cbc4]/15 ring-1 ring-[#80cbc4]/40 text-gray-700'
                  : isLow
                    ? 'bg-gray-50/60 text-gray-400 border border-dashed border-gray-200'
                    : 'bg-gray-100/60 text-gray-600'
              }`}
              onClick={() => toggleSelect(tag)}
            >
              <span>{tag}</span>
              <span className="text-xs opacity-60">({count}次)</span>
              <button
                onClick={e => {
                  e.stopPropagation();
                  handleDelete(tag, count);
                }}
                className="ml-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-opacity"
                aria-label={`删除标签 ${tag}`}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <button
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            className="px-2 py-1 rounded hover:bg-gray-100/60 disabled:opacity-30"
          >
            上一页
          </button>
          <span>{page + 1} / {totalPages}</span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
            className="px-2 py-1 rounded hover:bg-gray-100/60 disabled:opacity-30"
          >
            下一页
          </button>
        </div>
      )}

      {/* Merge bar */}
      {showMergeConfirm && selected.size >= 2 && (
        <div className="bg-[#80cbc4]/5 border border-[#80cbc4]/20 rounded-xl p-4 space-y-3">
          <p className="text-sm text-gray-600">
            已选择 <strong>{selected.size}</strong> 个标签，合并为：
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={mergeTarget}
              onChange={e => setMergeTarget(e.target.value)}
              className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white/80 focus:outline-none focus:border-[#80cbc4] transition-colors"
              placeholder="输入目标标签名"
            />
            <button
              onClick={handleMerge}
              disabled={!mergeTarget.trim()}
              className="text-sm px-4 py-1.5 rounded-lg bg-[#80cbc4] text-white hover:bg-[#80cbc4]/90 disabled:opacity-40 transition-colors"
            >
              合并
            </button>
            <button
              onClick={() => { setSelected(new Set()); setShowMergeConfirm(false); }}
              className="text-sm px-3 py-1.5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">
        共 {tags.length} 个标签 · 点击选择标签进行合并，虚线边框表示低频标签（&lt;3次）
      </p>
    </div>
  );
}

// ─── Category Management Section ─────────────────────────────────────────────

function CategorySection() {
  const [categories, setCategories] = useState<TopicCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const cats = await listCategories();
      setCategories(cats);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    if (categories.some(c => c.name === name)) {
      window.alert('已存在同名主题');
      return;
    }
    await addCategory(name);
    setNewName('');
    await loadCategories();
  };

  const handleSaveEdit = async (id: number) => {
    const name = editName.trim();
    if (!name) return;
    if (categories.some(c => c.name === name && c.id !== id)) {
      window.alert('已存在同名主题');
      return;
    }
    await updateCategory(id, { name });
    setEditingId(null);
    setEditName('');
    await loadCategories();
  };

  const handleDelete = async (cat: TopicCategory) => {
    const ok = window.confirm(`确认删除主题「${cat.name}」？`);
    if (!ok) return;
    await deleteCategory(cat.id!);
    await loadCategories();
  };

  if (loading) {
    return <div className="h-20 bg-gray-100/60 animate-pulse rounded-lg" />;
  }

  return (
    <div className="space-y-3">
      {/* Category list */}
      <div className="space-y-2">
        {categories.map(cat => (
          <div
            key={cat.id}
            className="flex items-center gap-2 py-1.5 px-3 rounded-lg hover:bg-gray-50/60 transition-colors group"
          >
            {editingId === cat.id ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveEdit(cat.id!);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onBlur={() => handleSaveEdit(cat.id!)}
                  autoFocus
                  className="flex-1 text-sm px-2 py-0.5 rounded border border-[#80cbc4] bg-white/80 focus:outline-none"
                />
                <button
                  onClick={() => handleSaveEdit(cat.id!)}
                  className="text-[#80cbc4] hover:text-[#80cbc4]/80"
                >
                  <Check size={14} />
                </button>
              </>
            ) : (
              <>
                <span
                  className="flex-1 text-sm text-gray-600 cursor-pointer"
                  onClick={() => {
                    setEditingId(cat.id!);
                    setEditName(cat.name);
                  }}
                >
                  {cat.name}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    cat.isBuiltin
                      ? 'bg-blue-500/10 text-blue-500'
                      : 'bg-green-500/10 text-green-600'
                  }`}
                >
                  {cat.isBuiltin ? '内置' : '自定义'}
                </span>
                <button
                  onClick={() => {
                    setEditingId(cat.id!);
                    setEditName(cat.name);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity"
                  aria-label="编辑"
                >
                  <Pencil size={12} />
                </button>
                {!cat.isBuiltin && (
                  <button
                    onClick={() => handleDelete(cat)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-opacity"
                    aria-label="删除"
                  >
                    <X size={14} />
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add new category */}
      <div className="flex items-center gap-2 pt-2 border-t border-black/5">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleAdd();
          }}
          placeholder="新增一级主题…"
          className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white/80 focus:outline-none focus:border-[#80cbc4] transition-colors"
        />
        <button
          onClick={handleAdd}
          disabled={!newName.trim()}
          className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-[#80cbc4]/10 text-[#80cbc4] hover:bg-[#80cbc4]/20 disabled:opacity-40 transition-colors"
        >
          <Plus size={14} />
          添加
        </button>
      </div>
    </div>
  );
}

// ─── Main TagManagement Component ────────────────────────────────────────────

export function TagManagement() {
  const [categoryOpen, setCategoryOpen] = useState(false);

  return (
    <section className="bg-white/60 backdrop-blur-sm border border-black/5 rounded-2xl p-6 space-y-6">
      <h2 className="text-lg font-light text-gray-700">标签与主题管理</h2>

      {/* Tag management */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Tags size={16} className="text-[#80cbc4]" />
          <h3 className="text-sm font-medium text-gray-600">标签管理</h3>
        </div>
        <TagSection />
      </div>

      {/* Divider */}
      <div className="border-t border-black/5" />

      {/* Category management - collapsible */}
      <div className="space-y-3">
        <button
          onClick={() => setCategoryOpen(!categoryOpen)}
          className="flex items-center gap-2 w-full text-left group"
        >
          <FolderTree size={16} className="text-[#80cbc4]" />
          <h3 className="text-sm font-medium text-gray-600 flex-1">一级主题管理</h3>
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform duration-200 ${
              categoryOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
        {categoryOpen && <CategorySection />}
      </div>
    </section>
  );
}
