'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { MindlogReport } from '@/components/mindlog/mindlog-report';

// 生成组件按需懒加载（与仪表盘保持一致）
const MindlogGenerate = dynamic(
  () => import('@/components/mindlog/mindlog-generate').then((m) => ({ default: m.MindlogGenerate })),
  { ssr: false }
);

type View = 'report' | 'generating';

/**
 * 心智日志独立报告页
 * - 整页纵向滚动（不同于仪表盘的单屏不滚动）
 * - 不渲染问候语 / 今日回响 / 底部诗句，纯净阅读视图
 * - 复用 MindlogReport（日/周/月 Tab）+ MindlogGenerate（生成态自含）
 */
export default function MindlogPage() {
  const router = useRouter();
  const [view, setView] = useState<View>('report');
  const [generateType, setGenerateType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [reportKey, setReportKey] = useState(0);

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  }

  function handleGenerate(type: 'daily' | 'weekly' | 'monthly') {
    setGenerateType(type);
    setView('generating');
  }

  function handleGenerateComplete() {
    setView('report');
    // 触发 MindlogReport 重新挂载以拉取最新数据
    setReportKey((k) => k + 1);
  }

  function handleGenerateError(msg: string) {
    console.error('MindLog generate error:', msg);
    setView('report');
  }

  return (
    <div className="fixed inset-0 overflow-y-auto flex flex-col" style={{ background: 'linear-gradient(135deg, #e8f5e9 0%, #e0f2f1 25%, #e3f2fd 50%, #fafaf8 75%, #fff8e1 100%)' }}>
      <div className="flex-1 px-6 pt-14 pb-12 max-w-[800px] w-full mx-auto">
        <AnimatePresence mode="wait">
          {view === 'report' && (
            <motion.div
              key={`report-${reportKey}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <MindlogReport
                onBack={handleBack}
                onGenerate={handleGenerate}
              />
            </motion.div>
          )}

          {view === 'generating' && (
            <motion.div
              key="generating"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <MindlogGenerate
                type={generateType}
                isGenerating={true}
                onComplete={handleGenerateComplete}
                onError={handleGenerateError}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
