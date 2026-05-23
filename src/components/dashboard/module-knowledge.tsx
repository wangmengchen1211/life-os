'use client';

import { useState, useCallback, useEffect } from 'react';
import KnowledgeList, { type ListState } from '@/components/knowledge/knowledge-list';
import KnowledgeCapture from '@/components/knowledge/knowledge-capture';
import KnowledgeDetail from '@/components/knowledge/knowledge-detail';
import KnowledgeGraph from '@/components/knowledge/knowledge-graph';

type ViewMode = 'list' | 'capture' | 'detail' | 'graph';

interface ModuleKnowledgeProps {
  initialItemId?: number | null;
}

export function ModuleKnowledge({ initialItemId }: ModuleKnowledgeProps) {
  const [view, setView] = useState<ViewMode>(initialItemId ? 'detail' : 'list');
  const [selectedItemId, setSelectedItemId] = useState<number | null>(initialItemId ?? null);
  const [savedListState, setSavedListState] = useState<ListState | null>(null);

  const handleSelectItem = useCallback((id: number) => {
    setSelectedItemId(id);
    setView('detail');
  }, []);

  const handleStateCapture = useCallback((state: ListState) => {
    setSavedListState(state);
  }, []);

  const handleCapture = useCallback(() => {
    setView('capture');
  }, []);

  const handleViewGraph = useCallback(() => {
    setView('graph');
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedItemId(null);
    setView('list');
  }, []);

  const handleDeleted = useCallback(() => {
    setSelectedItemId(null);
    setSavedListState(null);
    setView('list');
  }, []);

  // Listen for cross-component navigation events (from related knowledge links)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.itemId) {
        handleSelectItem(detail.itemId);
      }
    };
    window.addEventListener('knowledge-navigate', handler);
    return () => window.removeEventListener('knowledge-navigate', handler);
  }, [handleSelectItem]);

  return (
    <div className="h-full">
      {view === 'list' && (
        <KnowledgeList
          onSelectItem={handleSelectItem}
          onCapture={handleCapture}
          onViewGraph={handleViewGraph}
          onStateCapture={handleStateCapture}
          initialViewMode={savedListState?.viewMode}
          initialCategory={savedListState?.selectedCategory}
          initialScrollTop={savedListState?.scrollTop}
        />
      )}
      {view === 'capture' && (
        <KnowledgeCapture
          onSaved={handleBackToList}
          onCancel={handleBackToList}
        />
      )}
      {view === 'detail' && selectedItemId !== null && (
        <KnowledgeDetail
          itemId={selectedItemId}
          onBack={handleBackToList}
          onDeleted={handleDeleted}
        />
      )}
      {view === 'graph' && (
        <KnowledgeGraph
          onSelectNode={handleSelectItem}
          onBack={handleBackToList}
        />
      )}
    </div>
  );
}
