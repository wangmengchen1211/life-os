'use client';

import { useState, useCallback } from 'react';
import DiaryList from '@/components/diary/diary-list';
import DiaryDetail from '@/components/diary/diary-detail';
import DiaryWrite from '@/components/diary/diary-write';

type ViewMode = 'list' | 'write' | 'detail';

interface ModuleDiaryProps {
  initialEntryId?: number | null;
}

export function ModuleDiary({ initialEntryId }: ModuleDiaryProps) {
  const [view, setView] = useState<ViewMode>(initialEntryId ? 'detail' : 'list');
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(initialEntryId ?? null);
  const [refreshKey, setRefreshKey] = useState(0);
  // 写日记的目标日期（null = 今天）
  const [writeDate, setWriteDate] = useState<string | null>(null);

  const handleWrite = useCallback(() => {
    setWriteDate(null);
    setView('write');
  }, []);
  // 点击日历空日期 → 以该日期进入写日记（补写过去/未来的日记）
  const handleWriteAt = useCallback((date: string) => {
    setWriteDate(date);
    setView('write');
  }, []);
  const handleSaved = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setView('list');
  }, []);
  const handleSelectEntry = useCallback((id: number) => {
    setSelectedEntryId(id);
    setView('detail');
  }, []);
  const handleBack = useCallback(() => setView('list'), []);

  return (
    <div className="h-full">
      {view === 'list' && (
        <DiaryList
          key={refreshKey}
          refreshKey={refreshKey}
          onSelectEntry={handleSelectEntry}
          onWrite={handleWrite}
          onWriteAt={handleWriteAt}
          focusDate={writeDate}
        />
      )}
      {view === 'write' && (
        <DiaryWrite
          initialDate={writeDate ?? undefined}
          onSaved={handleSaved}
          onCancel={handleBack}
        />
      )}
      {view === 'detail' && selectedEntryId && (
        <DiaryDetail
          entryId={selectedEntryId}
          onBack={handleBack}
          onDeleted={handleSaved}
        />
      )}
    </div>
  );
}
