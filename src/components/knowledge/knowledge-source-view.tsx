'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FolderOpen, FileText, Layers, GripVertical, ChevronRight, ChevronDown, X } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCard } from '@/components/ui/skeleton';
import {
  getSourceCollections,
  listItemsBySourceCollection,
  listItems,
  listContainsLinks,
  setParent,
  removeParent,
  type KnowledgeItem,
  type KnowledgeLink,
} from '@/lib/storage/knowledge-store';
import { safeText } from '@/lib/utils/safe-text';

// ─── Types ───────────────────────────────────────────────────────────────────

interface KnowledgeSourceViewProps {
  onSelectItem?: (id: number) => void;
}

interface SourceCollection {
  name: string;
  count: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Check if targetId is a descendant of ancestorId */
function isDescendant(
  ancestorId: number,
  targetId: number,
  childrenMap: Map<number, number[]>
): boolean {
  const children = childrenMap.get(ancestorId);
  if (!children) return false;
  for (const childId of children) {
    if (childId === targetId) return true;
    if (isDescendant(childId, targetId, childrenMap)) return true;
  }
  return false;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function KnowledgeSourceView({ onSelectItem }: KnowledgeSourceViewProps) {
  const [collections, setCollections] = useState<SourceCollection[]>([]);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Hierarchy state
  const [parentMap, setParentMap] = useState<Map<number, number>>(new Map());
  const [childrenMap, setChildrenMap] = useState<Map<number, number[]>>(new Map());
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());

  // Drag state
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const dragCounterRef = useRef<Map<number, number>>(new Map());

  // Load hierarchy data
  const loadHierarchy = useCallback(async () => {
    try {
      const links = await listContainsLinks();
      const pMap = new Map<number, number>();
      const cMap = new Map<number, number[]>();
      for (const link of links) {
        pMap.set(link.itemBId, link.itemAId);
        const existing = cMap.get(link.itemAId) || [];
        existing.push(link.itemBId);
        cMap.set(link.itemAId, existing);
      }
      setParentMap(pMap);
      setChildrenMap(cMap);
    } catch {
      setParentMap(new Map());
      setChildrenMap(new Map());
    }
  }, []);

  // Load source collections
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const cols = await getSourceCollections();
        setCollections(cols);
      } catch {
        setCollections([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load items for selected collection
  const loadItems = useCallback(async (collection: string | null) => {
    setItemsLoading(true);
    try {
      if (collection === null) {
        const all = await listItems();
        setItems(all.filter((item) => item.sourceCollection));
      } else if (collection === '__uncategorized__') {
        const all = await listItems();
        setItems(all.filter((item) => !item.sourceCollection));
      } else {
        const result = await listItemsBySourceCollection(collection);
        setItems(result);
      }
    } catch {
      setItems([]);
    } finally {
      setItemsLoading(false);
    }
  }, []);

  // Auto-load items and hierarchy when active collection changes
  useEffect(() => {
    loadItems(activeCollection);
    loadHierarchy();
  }, [activeCollection, loadItems, loadHierarchy]);

  // Check if there are any uncategorized items
  const [hasUncategorized, setHasUncategorized] = useState(false);
  useEffect(() => {
    (async () => {
      const all = await listItems();
      setHasUncategorized(all.some((item) => !item.sourceCollection));
    })();
  }, []);

  // ─── Drag Handlers ─────────────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, itemId: number) => {
    setDraggedId(itemId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(itemId));
  };

  const handleDragOver = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (draggedId === null || draggedId === targetId) return;
    // Prevent dropping parent onto its own descendant
    if (isDescendant(draggedId, targetId, childrenMap)) return;
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(targetId);
  };

  const handleDragEnter = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    const counter = (dragCounterRef.current.get(targetId) || 0) + 1;
    dragCounterRef.current.set(targetId, counter);
    if (draggedId !== null && draggedId !== targetId && !isDescendant(draggedId, targetId, childrenMap)) {
      setDragOverId(targetId);
    }
  };

  const handleDragLeave = (_e: React.DragEvent, targetId: number) => {
    const counter = (dragCounterRef.current.get(targetId) || 0) - 1;
    dragCounterRef.current.set(targetId, counter);
    if (counter <= 0) {
      dragCounterRef.current.set(targetId, 0);
      if (dragOverId === targetId) {
        setDragOverId(null);
      }
    }
  };

  const handleDrop = async (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    dragCounterRef.current.clear();
    setDragOverId(null);

    if (draggedId === null || draggedId === targetId) {
      setDraggedId(null);
      return;
    }
    // Prevent circular: can't drop parent onto descendant
    if (isDescendant(draggedId, targetId, childrenMap)) {
      setDraggedId(null);
      return;
    }

    await setParent(draggedId, targetId);
    setDraggedId(null);
    await loadHierarchy();
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
    dragCounterRef.current.clear();
  };

  const handleRemoveParent = async (e: React.MouseEvent, childId: number) => {
    e.stopPropagation();
    await removeParent(childId);
    await loadHierarchy();
  };

  const toggleCollapse = (e: React.MouseEvent, itemId: number) => {
    e.stopPropagation();
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // ─── Tree Rendering ────────────────────────────────────────────────────────

  const itemMap = new Map<number, KnowledgeItem>();
  for (const item of items) {
    if (item.id != null) itemMap.set(item.id, item);
  }

  // Get top-level items (no parent, or parent not in current view)
  const topLevelItems = items.filter((item) => {
    if (item.id == null) return true;
    const pid = parentMap.get(item.id);
    return pid === undefined || !itemMap.has(pid);
  });

  function renderItem(item: KnowledgeItem, depth: number) {
    const itemId = item.id!;
    const children = childrenMap.get(itemId) || [];
    const visibleChildren = children.filter((cid) => itemMap.has(cid));
    const hasChildren = visibleChildren.length > 0;
    const isCollapsed = collapsedIds.has(itemId);
    const isDragging = draggedId === itemId;
    const isDropTarget = dragOverId === itemId;
    const isChild = parentMap.has(itemId);
    const isChildItem = depth > 0;

    return (
      <div key={itemId} className={isChildItem ? 'mt-1' : ''}>
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, itemId)}
          onDragOver={(e) => handleDragOver(e, itemId)}
          onDragEnter={(e) => handleDragEnter(e, itemId)}
          onDragLeave={(e) => handleDragLeave(e, itemId)}
          onDrop={(e) => handleDrop(e, itemId)}
          onDragEnd={handleDragEnd}
          className={`
            group flex items-center transition-all duration-200
            ${isChildItem ? 'gap-1 rounded-lg p-2 border-l-2 border-teal-300/50' : 'gap-1.5 rounded-xl p-2.5'}
            ${isDragging ? 'opacity-50' : ''}
            ${isDropTarget ? 'ring-2 ring-teal-400 bg-teal-50/50' : isChildItem ? 'bg-slate-50/60 hover:bg-slate-100/80 hover:shadow-sm' : 'bg-white/60 backdrop-blur-sm hover:bg-white/80 hover:shadow-sm'}
          `}
          style={{ marginLeft: depth * 24 }}
        >
          {/* Drag handle */}
          <div className="shrink-0 cursor-grab active:cursor-grabbing">
            <GripVertical size={isChildItem ? 12 : 14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
          </div>

          {/* Expand/Collapse toggle */}
          <div className={`shrink-0 flex items-center justify-center ${isChildItem ? 'w-3.5 h-3.5' : 'w-4 h-4'}`}>
            {hasChildren ? (
              <button
                onClick={(e) => toggleCollapse(e, itemId)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                {isCollapsed ? <ChevronRight size={isChildItem ? 12 : 14} /> : <ChevronDown size={isChildItem ? 12 : 14} />}
              </button>
            ) : (
              <span className={isChildItem ? 'w-3' : 'w-3.5'} />
            )}
          </div>

          {/* Item content - clickable */}
          <button
            onClick={() => onSelectItem?.(itemId)}
            className="flex-1 min-w-0 flex items-start gap-2 text-left"
          >
            <div className={`flex items-center justify-center shrink-0 mt-0.5 ${isChildItem ? 'w-5 h-5 rounded-md' : 'w-6 h-6 rounded-lg'} bg-white/80`}>
              <FileText size={isChildItem ? 11 : 13} className="text-teal-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className={`font-medium truncate ${isChildItem ? 'text-xs text-gray-600' : 'text-sm text-gray-700'}`}>
                {safeText(item.title)}
              </h4>
              <span className="text-[10px] text-gray-400 mt-0.5 inline-block">
                {formatDate(item.createdAt)}
              </span>
            </div>
          </button>

          {/* Remove parent button (only for child items) */}
          {isChild && (
            <button
              onClick={(e) => handleRemoveParent(e, itemId)}
              className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-100 text-gray-300 hover:text-red-500 transition-all"
              title="取消层级关系"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Render children */}
        {hasChildren && !isCollapsed && (
          <div className="relative">
            {/* Indent line */}
            <div
              className="absolute top-0 bottom-0 border-l border-gray-200/60"
              style={{ left: depth * 24 + 20 }}
            />
            {visibleChildren.map((childId) => {
              const childItem = itemMap.get(childId);
              if (!childItem) return null;
              return renderItem(childItem, depth + 1);
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (collections.length === 0 && !hasUncategorized) {
    return (
      <EmptyState
        icon={<Layers size={48} strokeWidth={1} />}
        title="暂无来源数据"
        description="导入 Obsidian 内容后，这里将按来源分组展示"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Collection Tags */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setActiveCollection(null)}
          className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-all duration-200 ${
            activeCollection === null
              ? 'bg-teal-100 text-teal-800 shadow-sm ring-1 ring-teal-300'
              : 'bg-black/5 text-gray-500 hover:bg-black/10 hover:text-gray-700'
          }`}
        >
          全部
        </button>
        {collections.map((col) => (
          <button
            key={col.name}
            onClick={() => setActiveCollection(col.name)}
            className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 ${
              activeCollection === col.name
                ? 'bg-teal-100 text-teal-800 shadow-sm ring-1 ring-teal-300'
                : 'bg-black/5 text-gray-500 hover:bg-black/10 hover:text-gray-700'
            }`}
          >
            <FolderOpen size={12} />
            <span>{col.name}</span>
            <span className="text-[10px] opacity-60">({col.count})</span>
          </button>
        ))}
        {hasUncategorized && (
          <button
            onClick={() => setActiveCollection('__uncategorized__')}
            className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-all duration-200 ${
              activeCollection === '__uncategorized__'
                ? 'bg-teal-100 text-teal-800 shadow-sm ring-1 ring-teal-300'
                : 'bg-black/5 text-gray-500 hover:bg-black/10 hover:text-gray-700'
            }`}
          >
            未分类
          </button>
        )}
      </div>

      {/* Items Tree */}
      {itemsLoading ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-400">该来源集暂无条目</p>
        </div>
      ) : (
        <div className="space-y-1">
          {topLevelItems.map((item) => renderItem(item, 0))}
        </div>
      )}
    </div>
  );
}
