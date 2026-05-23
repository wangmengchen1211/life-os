'use client';
import { useState, useEffect } from 'react';

export function SystemInfo() {
  const [storage, setStorage] = useState<string>('计算中…');

  useEffect(() => {
    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then(est => {
        const used = ((est.usage || 0) / 1024 / 1024).toFixed(1);
        const total = ((est.quota || 0) / 1024 / 1024 / 1024).toFixed(1);
        setStorage(`${used} MB / ${total} GB`);
      });
    } else {
      setStorage('无法估算');
    }
  }, []);

  return (
    <section className="bg-white/60 backdrop-blur-sm border border-black/5 rounded-2xl p-6">
      <h2 className="text-lg font-light text-gray-700 mb-4">系统信息</h2>
      <div className="space-y-2 text-sm text-gray-500">
        <div className="flex justify-between">
          <span>版本</span>
          <span className="text-gray-400">v0.1.0</span>
        </div>
        <div className="flex justify-between">
          <span>本地存储</span>
          <span className="text-gray-400">{storage}</span>
        </div>
        <div className="pt-3 mt-3 border-t border-black/5 text-center text-xs text-gray-300 italic">
          MindOS · 心智系统
        </div>
      </div>
    </section>
  );
}
