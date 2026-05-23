'use client';
import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';

interface BillingInfo {
  available: boolean;
  data?: { used?: string };
  consoleUrl?: string;
}

export function AiBudgetSettings() {
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ai/billing')
      .then(r => r.json())
      .then(data => setBilling(data))
      .catch(() => setBilling({ available: false }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="bg-white/60 backdrop-blur-sm border border-black/5 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={18} className="text-[#80cbc4]" />
        <h2 className="text-lg font-light text-gray-700">心智点数</h2>
      </div>

      {loading ? (
        <div className="h-12 bg-gray-100/60 animate-pulse rounded-lg" />
      ) : billing?.available ? (
        <div className="space-y-3">
          {/* 显示余额信息 */}
          <div className="flex justify-between text-sm text-gray-500">
            <span>已用额度</span>
            <span>{billing.data?.used || '—'}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#80cbc4] rounded-full transition-all"
              style={{ width: '30%' }}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-400 italic">
            余额信息暂不可用
          </p>
          <a
            href={billing?.consoleUrl || 'https://dashscope.console.aliyun.com/'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#80cbc4] hover:underline"
          >
            前往控制台查看心智点数 →
          </a>
        </div>
      )}
    </section>
  );
}
