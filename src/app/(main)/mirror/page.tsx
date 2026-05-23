'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronLeft, History } from 'lucide-react';
import { ModuleMirror, MirrorSidebar } from '@/components/dashboard/module-mirror';
import { listSessions, createSession, deleteSession, type MirrorSession } from '@/lib/storage/mirror-store';

function MirrorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from');
  const initialQuestion = searchParams.get('question');
  const handleBack = () => {
    if (from) {
      router.push(decodeURIComponent(from));
    } else {
      router.push('/');
    }
  };
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<MirrorSession[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // 键盘适配：监听 VisualViewport 变化，动态调整容器高度
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => setViewportHeight(vv.height);
    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleResize);
    handleResize(); // 初始化
    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
    };
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const list = await listSessions();
      setSessions(list);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  async function handleNewSession() {
    try {
      const id = await createSession('新对话');
      setActiveSessionId(id);
      await loadSessions();
    } catch {
      // silent
    }
  }

  async function handleDeleteSession(id: number) {
    try {
      await deleteSession(id);
      if (activeSessionId === id) {
        setActiveSessionId(null);
      }
      await loadSessions();
    } catch {
      // silent
    }
  }

  function handleSessionCreated(id: number) {
    setActiveSessionId(id);
    loadSessions();
  }

  return (
    <div
      className="overflow-hidden flex flex-col"
      style={{ height: viewportHeight ? `${viewportHeight}px` : '100dvh' }}
    >
      {/* 顶部返回栏 */}
      <div className="flex items-center gap-2 px-4 pt-14 pb-2 flex-shrink-0">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          onClick={handleBack}
          className="w-8 h-8 rounded-full bg-white/60 backdrop-blur-sm border border-black/5 flex items-center justify-center hover:bg-white/80 transition-all"
        >
          <ChevronLeft size={16} className="text-gray-600" />
        </motion.button>
        <h1 className="text-base font-medium text-gray-700">镜像洞见</h1>

        {/* 历史会话按钮 */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="ml-auto w-8 h-8 rounded-full bg-white/60 backdrop-blur-sm border border-black/5 flex items-center justify-center hover:bg-white/80 transition-all"
        >
          <History size={14} className="text-gray-400" />
        </button>
      </div>

      {/* 模块内容 */}
      <div className="flex-1 min-h-0 px-3 pb-4">
        <ModuleMirror
          sessionId={activeSessionId}
          onSessionCreated={handleSessionCreated}
          initialQuestion={initialQuestion || undefined}
        />
      </div>

      {/* 历史会话侧边栏 */}
      <MirrorSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={setActiveSessionId}
        onNew={handleNewSession}
        onDelete={handleDeleteSession}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </div>
  );
}

export default function MirrorPage() {
  return (
    <Suspense>
      <MirrorContent />
    </Suspense>
  );
}
