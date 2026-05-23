'use client';
import { useState } from 'react';
import { openDB } from 'idb';
import { Download, Trash2 } from 'lucide-react';

const modules = [
  { key: 'diary-db', store: 'entries', label: '日记回音' },
  { key: 'knowledge-db', store: 'items', label: '思维藤蔓' },
  { key: 'todo-db', store: 'todos', label: 'Todo 轻约' },
  { key: 'mindlog-db', store: 'entries', label: '心智日志' },
];

export function DataManagement() {
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data: Record<string, unknown[]> = {};
      for (const mod of modules) {
        try {
          const db = await openDB(mod.key, undefined, { upgrade() {} });
          data[mod.key] = await db.getAll(mod.store);
          db.close();
        } catch {
          data[mod.key] = [];
        }
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mindos-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      for (const key of selected) {
        const mod = modules.find(m => m.key === key);
        if (mod) {
          const db = await openDB(mod.key, undefined, { upgrade() {} });
          await db.clear(mod.store);
          db.close();
        }
      }
      setSelected([]);
      setShowConfirm(false);
    } finally {
      setClearing(false);
    }
  };

  return (
    <section className="bg-white/60 backdrop-blur-sm border border-black/5 rounded-2xl p-6">
      <h2 className="text-lg font-light text-gray-700 mb-4">数据管理</h2>

      {/* 导出 */}
      <button
        onClick={handleExport}
        disabled={exporting}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#80cbc4] transition-colors mb-6"
      >
        <Download size={16} />
        {exporting ? '导出中…' : '导出全部数据为 JSON'}
      </button>

      {/* 清除 */}
      <div className="border-t border-black/5 pt-4">
        <p className="text-sm text-gray-500 mb-3">选择要清除的模块数据：</p>
        <div className="space-y-2 mb-4">
          {modules.map(mod => (
            <label key={mod.key} className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={selected.includes(mod.key)}
                onChange={e => {
                  setSelected(prev =>
                    e.target.checked ? [...prev, mod.key] : prev.filter(k => k !== mod.key),
                  );
                }}
                className="rounded border-gray-300"
              />
              {mod.label}
            </label>
          ))}
        </div>

        {selected.length > 0 && !showConfirm && (
          <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-2 text-sm text-red-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={16} />
            清除选中数据
          </button>
        )}

        {showConfirm && (
          <div className="bg-red-50/50 rounded-xl p-4 space-y-3">
            <p className="text-sm text-red-500">确认清除？此操作不可恢复。</p>
            <div className="flex gap-3">
              <button
                onClick={handleClear}
                disabled={clearing}
                className="text-sm text-red-500 font-medium"
              >
                {clearing ? '清除中…' : '确认清除'}
              </button>
              <button onClick={() => setShowConfirm(false)} className="text-sm text-gray-400">
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
