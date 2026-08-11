'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

// ─── 防暴力破解：连续失败锁定 ───────────────────────────────────────────────
const LOCK_KEY = 'mindos_login_lock_until';
const FAILS_KEY = 'mindos_login_fails';
const MAX_FAILS = 5; // 连续失败上限
const LOCK_MS = 5 * 60 * 1000; // 锁定时长：5 分钟

function LoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [agreed, setAgreed] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // 锁定状态（mount 后从 localStorage 恢复，避免 SSR 水合不一致）
  const [lockUntil, setLockUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setLockUntil(Number(localStorage.getItem(LOCK_KEY)) || 0);
  }, []);
  const locked = lockUntil > now;
  useEffect(() => {
    if (!locked) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [locked]);
  const lockSecondsLeft = locked ? Math.ceil((lockUntil - now) / 1000) : 0;

  function recordFailure() {
    const fails = Number(localStorage.getItem(FAILS_KEY) || '0') + 1;
    if (fails >= MAX_FAILS) {
      const until = Date.now() + LOCK_MS;
      localStorage.setItem(LOCK_KEY, String(until));
      localStorage.removeItem(FAILS_KEY);
      setLockUntil(until);
      setNow(Date.now());
      setError('尝试次数过多，请 5 分钟后再试');
    } else {
      localStorage.setItem(FAILS_KEY, String(fails));
      setError(`邮箱或密码不正确（连续失败 ${fails}/${MAX_FAILS}）`);
    }
  }

  function clearFailureState() {
    localStorage.removeItem(LOCK_KEY);
    localStorage.removeItem(FAILS_KEY);
    setLockUntil(0);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked || loading) return;
    if (mode === 'signup' && !agreed) return;
    setLoading(true);
    setError('');

    try {
      const supabase = createClient();

      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          if (signInError.message === 'Invalid login credentials') {
            recordFailure();
          } else {
            setError(signInError.message);
          }
          return;
        }
      } else {
        // 注册：前端先校验密码强度（与 Supabase 密码策略 ≥8 位对齐）
        if (password.length < 8) {
          setError('密码至少 8 位，请设置更强的密码');
          return;
        }
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        // 注册成功后尝试自动登录（如果未开启邮箱确认，会直接成功）
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          // 邮箱确认模式：提示用户查看邮箱
          setError('注册成功！请查看邮箱确认链接后登录。');
          setMode('login');
          return;
        }
      }

      // 登录成功
      clearFailureState();
      const redirect = searchParams.get('redirect') || '/';
      router.push(redirect);
      router.refresh();
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'var(--bg-gradient)' }}
    >
      {/* 背景柔光 */}
      <div className="absolute top-[-30%] left-[20%] w-[50%] h-[50%] rounded-full opacity-30 blur-[100px]"
           style={{ background: '#a8e6cf' }} />
      <div className="absolute bottom-[-20%] right-[10%] w-[40%] h-[40%] rounded-full opacity-25 blur-[120px]"
           style={{ background: '#88d4e0' }} />

      <div className="relative z-10 w-full max-w-sm p-8">
        <div className="text-center mb-12">
          <h1
            className="text-6xl font-extralight tracking-[0.15em]"
            style={{
              color: 'var(--text-primary)',
              textShadow: '0 0 40px rgba(77, 182, 160, 0.2)',
            }}
          >
            MindOS
          </h1>
          <p
            className="text-sm font-light tracking-[0.3em] mt-4 uppercase"
            style={{ color: 'var(--text-secondary)' }}
          >
            你的心智系统
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱"
            className="w-full px-5 py-3.5 rounded-2xl border border-white/60 text-center placeholder:text-gray-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-300/30 backdrop-blur-xl"
            style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}
            autoFocus
            required
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'signup' ? '密码（至少8位）' : '密码'}
            className="w-full px-5 py-3.5 rounded-2xl border border-white/60 text-center placeholder:text-gray-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-300/30 backdrop-blur-xl"
            style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}
            minLength={mode === 'signup' ? 8 : undefined}
            required
          />

          {error && (
            <p className="text-center text-sm text-red-500/70">{error}</p>
          )}

          {mode === 'signup' && (
            <label className="flex items-start gap-2.5 justify-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-[#80cbc4] focus:ring-[#80cbc4]/30"
              />
              <span className="text-xs text-gray-400 leading-relaxed">
                我已阅读并同意
                <Link
                  href="/privacy-policy"
                  target="_blank"
                  className="text-[#80cbc4] hover:text-[#4db6ac] underline underline-offset-2 transition-colors"
                >
                  《MindOS 用户隐私协议》
                </Link>
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={loading || locked || !email || !password || (mode === 'signup' && !agreed)}
            className="w-full py-3.5 rounded-2xl font-normal transition-all disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-xl"
            style={{
              background: 'rgba(77, 182, 160, 0.15)',
              color: '#3d9e8a',
            }}
          >
            {loading
              ? '处理中...'
              : locked
                ? `已锁定，${Math.floor(lockSecondsLeft / 60)}:${String(lockSecondsLeft % 60).padStart(2, '0')} 后重试`
                : mode === 'login'
                  ? '进入 MindOS'
                  : '注册并进入'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError('');
            }}
            className="text-sm text-gray-400 hover:text-[#80cbc4] transition-colors"
          >
            {mode === 'login'
              ? '没有账号？注册新账号'
              : '已有账号？返回登录'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams 需包裹在 Suspense 中，避免生产构建预渲染报错
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
