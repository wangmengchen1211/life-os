'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Disc } from 'lucide-react';
import { buildRecommendedTopics, type RecommendedQuestion } from '@/lib/ai/recommend-topics';

// ─── Component ───────────────────────────────────────────────────────────────

export function MirrorQuestionCard() {
  const router = useRouter();
  const [questions, setQuestions] = useState<RecommendedQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  // 基于最近数据（心智日志/日记/Todo/知识库）生成推荐问题
  useEffect(() => {
    let isMounted = true;

    async function loadQuestions() {
      try {
        const result = await buildRecommendedTopics(5);
        if (isMounted) {
          setQuestions(result);
          setLoading(false);
        }
      } catch {
        if (isMounted) {
          setQuestions([]);
          setLoading(false);
        }
      }
    }

    loadQuestions();
    return () => { isMounted = false; };
  }, []);

  // 自动轮播（24秒）
  useEffect(() => {
    if (questions.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % questions.length);
    }, 24000);
    return () => clearInterval(timer);
  }, [questions.length]);

  const handleClick = useCallback(() => {
    if (questions.length === 0) return;
    const q = questions[currentIdx];
    router.push(`/mirror?question=${encodeURIComponent(q.text)}&from=${encodeURIComponent('/')}`);
  }, [questions, currentIdx, router]);

  // 加载态
  if (loading) {
    return (
      <div className="w-full h-[96px] md:h-[112px] rounded-2xl bg-white/30 backdrop-blur-sm border border-black/5 flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Disc size={14} className="text-gray-300" />
        </motion.div>
      </div>
    );
  }

  if (questions.length === 0) {
    return null;
  }

  const current = questions[currentIdx];

  return (
    <div
      className="w-full h-[96px] md:h-[112px] rounded-2xl bg-white/30 backdrop-blur-sm border border-black/5 flex items-center gap-2.5 px-3 cursor-pointer hover:bg-white/50 transition-colors group"
      onClick={handleClick}
    >
      {/* 洞见图标 — 与导航栏中的 Disc 图标保持一致，使用紫色 */}
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: '#a78bfa15' }}
      >
        <Disc size={14} strokeWidth={1.5} style={{ color: '#a78bfa' }} />
      </div>

      {/* 推荐问题 */}
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          <motion.p
            key={currentIdx}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="text-sm font-light text-gray-500 truncate"
          >
            {current.text}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* 轮播指示 */}
      {questions.length > 1 && (
        <div className="flex gap-0.5 flex-shrink-0">
          {questions.slice(0, 5).map((_, i) => (
            <div
              key={i}
              className={`w-1 h-1 rounded-full transition-all duration-300 ${
                i === currentIdx % 5 ? 'bg-purple-300/60 w-2' : 'bg-gray-200/60'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
