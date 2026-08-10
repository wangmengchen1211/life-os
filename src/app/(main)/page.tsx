'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { getTimeTheme, getGreeting, type Greeting } from '@/lib/utils/time-theme';
import { getStats } from '@/lib/storage/knowledge-store';
import { getWeekCount } from '@/lib/storage/diary-store';
import { getTodayStats } from '@/lib/storage/todo-store';
import { PenLine, Brain, CheckSquare, Sparkles, Disc, CircleUserRound, ChevronLeft, ChevronRight } from 'lucide-react';
import dynamic from 'next/dynamic';

// MindLog 组件
import { MindlogSummary } from '@/components/mindlog/mindlog-summary';

const MindlogGenerate = dynamic(
  () => import('@/components/mindlog/mindlog-generate').then(m => ({ default: m.MindlogGenerate })),
  { ssr: false }
);

// 新增组件
import { DailyEcho } from '@/components/dashboard/daily-echo';
import { FooterQuote } from '@/components/dashboard/footer-quote';
// import { Serendipity, shouldShowSerendipity } from '@/components/dashboard/serendipity';
import { ProfilePanel } from '@/components/profile/profile-panel';
import { DiaryImageCard } from '@/components/dashboard/diary-image-card';
import { MirrorQuestionCard } from '@/components/dashboard/mirror-question-card';

interface NavItem {
  id: string;
  title: string;
  icon: typeof PenLine;
  color: string;
  stat: React.ReactNode;
  route: string;
}

type MindlogView = 'summary' | 'generating';

// 统计数字微动效组件
function AnimatedNumber({ value }: { value: number }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {value}
    </motion.span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [greeting, setGreeting] = useState<Greeting>({ main: '', sub: '' });
  const [knowledgeCount, setKnowledgeCount] = useState(0);
  const [diaryWeekCount, setDiaryWeekCount] = useState(0);
  const [todoPending, setTodoPending] = useState(0);
  // const [showSerendipity, setShowSerendipity] = useState(false);

  // MindLog 视图状态
  const [mindlogView, setMindlogView] = useState<MindlogView>('summary');
  const [generateType, setGenerateType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [isGenerating, setIsGenerating] = useState(false);
  const [mindlogKey, setMindlogKey] = useState(0);

  function handleMindlogGenerate(type: 'daily' | 'weekly' | 'monthly' = 'daily') {
    setGenerateType(type);
    setIsGenerating(true);
    setMindlogView('generating');
  }

  function handleMindlogComplete() {
    setIsGenerating(false);
    setMindlogView('summary');
    setMindlogKey((k) => k + 1);
  }

  function handleMindlogError(msg: string) {
    console.error('MindLog error:', msg);
    setIsGenerating(false);
    setMindlogView('summary');
  }

  const refreshDashboardStats = useCallback(() => {
    getStats().then((stats) => {
      setKnowledgeCount(stats.totalItems);
    }).catch(() => {});
    getWeekCount().then((count) => {
      setDiaryWeekCount(count);
    }).catch(() => {});
    getTodayStats().then((stats) => {
      setTodoPending(stats.pending);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setGreeting(getGreeting());
    const theme = getTimeTheme();
    document.documentElement.setAttribute('data-theme', theme);

    refreshDashboardStats();
    // setShowSerendipity(shouldShowSerendipity());
  }, [refreshDashboardStats]);

  // 页面重新可见时刷新统计
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshDashboardStats();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refreshDashboardStats]);

  const navItems: NavItem[] = [
    {
      id: 'diary',
      title: '日记回音',
      icon: PenLine,
      color: '#b39ddb',
      stat: <>本周<AnimatedNumber value={diaryWeekCount} />篇</>,
      route: '/diary',
    },
    {
      id: 'knowledge',
      title: '思维藤蔓',
      icon: Brain,
      color: '#80cbc4',
      stat: <>共<AnimatedNumber value={knowledgeCount} />条</>,
      route: '/knowledge',
    },
    {
      id: 'todos',
      title: 'Todo 轻约',
      icon: CheckSquare,
      color: '#ffcc80',
      stat: <>今日待办<AnimatedNumber value={todoPending} />项</>,
      route: '/todos',
    },
    {
      id: 'mirror',
      title: '镜像洞见',
      icon: Disc,
      color: '#a78bfa',
      stat: <>洞见</>,
      route: '/mirror',
    },
  ];

  return (
    <div className="h-[100dvh] overflow-y-auto md:overflow-hidden flex flex-col relative">
      {/* 主内容区 — 桌面单屏布局不允许滚动；移动端允许纵向滚动保证内容完整展开 */}
      <div className="flex-1 flex flex-col px-4 sm:px-6 pt-10 md:pt-12 pb-6 max-w-[800px] w-full mx-auto min-h-0 justify-center">
        {/* 顶部：品牌 + 时间 + 问候 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="flex-shrink-0"
        >
          <div className="flex items-baseline justify-center gap-3">
            <h1
              className="text-sm font-light tracking-[0.15em] uppercase text-center"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              MindOS
            </h1>
            <span className="text-sm font-light tracking-[0.3em] uppercase text-center" style={{ color: 'var(--color-text-secondary)' }}>
              你的心智系统
            </span>
          </div>
          {/* 品牌与日期间的若隐若现分割线 */}
          <div className="h-px bg-gradient-to-r from-transparent via-gray-300/25 to-transparent my-3" />
          <div className="flex items-center justify-between">
            <p className="text-sm md:text-base italic text-[var(--color-text-muted)] tracking-wider">
              {new Date().toLocaleDateString('zh-CN', {
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              })}
            </p>
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
          <h1 className="text-3xl md:text-4xl font-medium tracking-[var(--tracking-wider)] text-[var(--color-text)] mt-2 mb-1">
            {greeting.main}
          </h1>
          <p className="text-base md:text-lg font-medium text-[var(--color-text-secondary)] mb-2 tracking-wide">
            {greeting.sub}
          </p>
        </motion.div>

        {/* 中间：MindLog 内容区（固定高度，不弹性伸缩） */}
        <div className="flex-shrink-0 overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">
              {mindlogView === 'summary' && (
                    <MindlogSummary
                      key={`summary-${mindlogKey}`}
                      onViewReport={() => router.push('/mindlog')}
                      onGenerate={() => handleMindlogGenerate('daily')}
                    />
                  )}
                  {mindlogView === 'generating' && (
                    <MindlogGenerate
                      type={generateType}
                      isGenerating={isGenerating}
                      onComplete={handleMindlogComplete}
                      onError={handleMindlogError}
                    />
                  )}
            </AnimatePresence>
        </div>

        {/* 卡片区域：日记图片 + 洞见推荐提问，占据剩余空间 */}
        <div className="flex-1 min-h-0 flex flex-col gap-2.5 md:gap-3 mt-2.5 md:mt-3 justify-center">
          <DiaryImageCard />
          <MirrorQuestionCard />
        </div>

        {/* 今日回响 */}
        <div className="flex-shrink-0 mt-3">
          <DailyEcho />
        </div>

        {/* 底部诗句 */}
        <div className="flex-shrink-0 mt-1 pb-1">
          <FooterQuote />
        </div>
      </div>

      {/* 侧边栏触发按钮已移至 MindOS 标题行右侧 */}

      {/* 侧边栏抽屉 */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* 遮罩 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/30"
              onClick={() => setSidebarOpen(false)}
            />

            {/* 侧边栏面板 */}
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-[280px] bg-[#fafaf8] border-l border-black/5 shadow-xl flex flex-col"
            >
              {/* 侧边栏头部 */}
              <div className="flex items-center justify-between px-5 pt-14 pb-4">
                <h2 className="text-base font-medium text-gray-700 tracking-wide">模块导航</h2>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100/60 transition-colors"
                >
                  <ChevronRight size={16} className="text-gray-500" />
                </button>
              </div>

              {/* 导航列表 */}
              <div className="flex-1 px-4 space-y-3 overflow-y-auto pb-6">
                {navItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        type: 'spring',
                        stiffness: 300,
                        damping: 30,
                        delay: index * 0.06,
                      }}
                      onClick={() => {
                        setSidebarOpen(false);
                        router.push(item.route);
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/60 border border-black/5 hover:bg-white/80 hover:shadow-sm transition-all group"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${item.color}15` }}
                      >
                        <Icon size={18} strokeWidth={1.5} style={{ color: item.color }} />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                          {item.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {item.stat}
                        </p>
                      </div>
                      <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
                    </motion.button>
                  );
                })}

                {/* 用户/Profile 入口 */}
                <motion.button
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 30,
                    delay: navItems.length * 0.06,
                  }}
                  onClick={() => {
                    setSidebarOpen(false);
                    setShowProfile(true);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/60 border border-black/5 hover:bg-white/80 hover:shadow-sm transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-gray-100/60">
                    <CircleUserRound size={18} strokeWidth={1.5} className="text-gray-500" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                      我的
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">个人画像与设置</p>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
                </motion.button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* "我的"面板 */}
      <AnimatePresence>
        {showProfile && (
          <ProfilePanel onClose={() => setShowProfile(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
