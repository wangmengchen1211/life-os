'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { CircleUserRound, X, Settings, LogOut, Sparkles, ExternalLink, PenLine, Brain, CheckSquare, Sprout } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getProfileStats, type ProfileStats } from '@/lib/storage/stats';
import { getUserProfile, saveUserProfile } from '@/lib/storage/profile-store';
import { Skeleton } from '@/components/ui/skeleton';

interface ProfilePanelProps {
  onClose: () => void;
}

interface BillingData {
  available: boolean;
  data?: any;
  consoleUrl?: string;
}

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

export function ProfilePanel({ onClose }: ProfilePanelProps) {
  const router = useRouter();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // 用户配置
  const [nickname, setNickname] = useState('旅人');
  const [signature, setSignature] = useState('在心智的田野上，种下每一天');
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [isEditingSignature, setIsEditingSignature] = useState(false);
  const nicknameRef = useRef<HTMLInputElement>(null);
  const signatureRef = useRef<HTMLInputElement>(null);

  // AI 费用
  const [billing, setBilling] = useState<BillingData | null>(null);

  useEffect(() => {
    getProfileStats().then(setStats).catch(() => {});
    getUserProfile().then((p) => {
      setNickname(p.nickname);
      setSignature(p.signature);
    }).catch(() => {});
    fetch('/api/ai/billing')
      .then((r) => r.json())
      .then(setBilling)
      .catch(() => setBilling({ available: false, consoleUrl: 'https://dashscope.console.aliyun.com/' }));
  }, []);

  useEffect(() => {
    if (isEditingNickname) nicknameRef.current?.focus();
  }, [isEditingNickname]);

  useEffect(() => {
    if (isEditingSignature) signatureRef.current?.focus();
  }, [isEditingSignature]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function handleLogout() {
    setLoggingOut(true);
    try {
      // 走 Supabase Auth 真正登出（清除会话 JWT），随后中间件会拦截受保护页面
      await createClient().auth.signOut();
      router.push('/login');
    } catch {
      setLoggingOut(false);
    }
  }

  function handleNicknameConfirm() {
    setIsEditingNickname(false);
    const trimmed = nickname.trim() || '旅人';
    setNickname(trimmed);
    saveUserProfile({ nickname: trimmed });
  }

  function handleSignatureConfirm() {
    setIsEditingSignature(false);
    const trimmed = signature.trim() || '在心智的田野上，种下每一天';
    setSignature(trimmed);
    saveUserProfile({ signature: trimmed });
  }

  const statCards: {
    icon: typeof PenLine;
    color: string;
    label: string;
    value: string;
  }[] = stats
    ? [
        { icon: PenLine, color: '#b39ddb', label: '日记篇数', value: String(stats.diaryCount) },
        { icon: Brain, color: '#80cbc4', label: '知识条目', value: String(stats.knowledgeCount) },
        {
          icon: CheckSquare,
          color: '#ffcc80',
          label: '待办完成',
          value: `${stats.todoCompleted}/${stats.todoTotal}`,
        },
        { icon: Sprout, color: '#81c784', label: 'MindLog', value: String(stats.mindlogCount) },
      ]
    : [];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />

      {/* 面板 */}
      <motion.div
        className="relative w-full max-w-md mx-4 bg-[#fafaf8] rounded-3xl p-8 shadow-lg border border-black/5 max-h-[85vh] overflow-y-auto"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={springTransition}
      >
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-50/80 transition-colors duration-200"
          style={{ background: 'rgba(0,0,0,0.05)' }}
        >
          <X size={16} className="text-gray-500" />
        </button>

        {/* ── 用户区 ── */}
        <div className="flex flex-col items-center pt-2 pb-8">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ background: 'rgba(128,203,196,0.12)' }}
          >
            <CircleUserRound
              size={64}
              strokeWidth={1}
              style={{ color: '#80cbc4' }}
            />
          </div>

          {/* 昵称 - 可编辑 */}
          {isEditingNickname ? (
            <input
              ref={nicknameRef}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onBlur={handleNicknameConfirm}
              onKeyDown={(e) => e.key === 'Enter' && handleNicknameConfirm()}
              className="text-xl font-light tracking-wider text-gray-800 bg-transparent border-0 border-b border-dashed border-gray-300 outline-none text-center w-48 py-0.5"
              maxLength={20}
            />
          ) : (
            <h2
              className="text-xl font-light tracking-wider text-gray-800 cursor-pointer hover:opacity-70 transition-opacity duration-200 border-b border-dashed border-transparent hover:border-gray-300 pb-0.5"
              onClick={() => setIsEditingNickname(true)}
            >
              {nickname}
            </h2>
          )}

          {/* 签名 - 可编辑 */}
          {isEditingSignature ? (
            <input
              ref={signatureRef}
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              onBlur={handleSignatureConfirm}
              onKeyDown={(e) => e.key === 'Enter' && handleSignatureConfirm()}
              className="text-sm italic text-gray-400 opacity-70 mt-2 bg-transparent border-0 border-b border-dashed border-gray-300 outline-none text-center w-64 py-0.5"
              maxLength={50}
            />
          ) : (
            <p
              className="text-sm italic text-gray-400 opacity-70 mt-2 cursor-pointer hover:opacity-50 transition-opacity duration-200 border-b border-dashed border-transparent hover:border-gray-300 pb-0.5"
              onClick={() => setIsEditingSignature(true)}
            >
              {signature}
            </p>
          )}
        </div>

        {/* ── 心智足迹 ── */}
        <div className="mb-8">
          <h3 className="text-sm italic text-gray-400 opacity-70 mb-4 tracking-wide">
            心智足迹
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {stats === null
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-white/40 backdrop-blur-sm rounded-xl p-4 border border-black/5 flex flex-col items-center justify-center"
                  >
                    <Skeleton className="h-8 w-12" />
                  </div>
                ))
              : statCards.map((card) => {
                  const Icon = card.icon;
                  return (
                  <div
                    key={card.label}
                    className="bg-white/40 backdrop-blur-sm rounded-xl p-4 border border-black/5 flex flex-col items-center gap-1"
                  >
                    <Icon size={20} strokeWidth={1.5} style={{ color: card.color }} />
                    <span className="text-2xl font-light text-gray-700">
                      {card.value}
                    </span>
                    <span className="text-xs italic text-gray-400">
                      {card.label}
                    </span>
                  </div>
                  );
                })}
          </div>
        </div>

        {/* ── 心智点数 ── */}
        <div className="mb-8">
          <h3 className="text-sm italic text-gray-400 opacity-70 mb-4 tracking-wide flex items-center gap-1.5">
            <Sparkles size={14} strokeWidth={1.5} style={{ color: '#80cbc4' }} />
            心智点数
          </h3>
          <div className="bg-white/40 backdrop-blur-sm rounded-xl p-4 border border-black/5">
            {billing === null ? (
              <span className="text-sm text-gray-300 italic">加载中…</span>
            ) : billing.available && billing.data ? (
              <div className="flex flex-col gap-2">
                {billing.data.total_granted != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">总额度</span>
                    <span className="text-gray-700 font-light">
                      ${Number(billing.data.total_granted).toFixed(2)}
                    </span>
                  </div>
                )}
                {billing.data.total_used != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">已使用</span>
                    <span className="text-gray-700 font-light">
                      ${Number(billing.data.total_used).toFixed(2)}
                    </span>
                  </div>
                )}
                {billing.data.total_available != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">剩余</span>
                    <span className="font-light" style={{ color: '#80cbc4' }}>
                      ${Number(billing.data.total_available).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <a
                href={billing.consoleUrl || 'https://dashscope.console.aliyun.com/'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm flex items-center gap-1.5 transition-colors duration-200 hover:opacity-70"
                style={{ color: '#80cbc4' }}
              >
                查看心智点数
                <ExternalLink size={13} strokeWidth={1.5} />
              </a>
            )}
          </div>
        </div>

        {/* ── 快捷操作 ── */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <button
            onClick={() => {
              onClose();
              router.push('/settings');
            }}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200 flex items-center gap-1.5"
          >
            <Settings size={14} strokeWidth={1.5} />
            偏好设置
          </button>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors duration-200 flex items-center gap-1.5 disabled:opacity-50"
          >
            <LogOut size={14} strokeWidth={1.5} />
            {loggingOut ? '退出中…' : '退出登录'}
          </button>
        </div>

        {/* ── 底部 ── */}
        <div className="text-center pt-4 border-t border-black/5">
          <p className="text-xs text-gray-300 italic">v0.1.0</p>
          <p className="text-xs text-gray-300 italic mt-1">
            MindOS · 心智系统
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
