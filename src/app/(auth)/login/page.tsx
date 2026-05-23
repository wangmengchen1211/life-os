'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) return;
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      
      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        setError('密码不正确，请重试');
      }
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
        <div className="text-center mb-14">
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
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="输入密码"
            className="w-full px-5 py-3.5 rounded-2xl border border-white/60 text-center placeholder:text-gray-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-300/30 backdrop-blur-xl"
            style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}
            autoFocus
          />
          
          {error && (
            <p className="text-center text-sm text-red-500/70">{error}</p>
          )}
          
          {/* 隐私协议 */}
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
          
          <button
            type="submit"
            disabled={loading || !password || !agreed}
            className="w-full py-3.5 rounded-2xl font-normal transition-all disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-xl"
            style={{ 
              background: 'rgba(77, 182, 160, 0.15)',
              color: '#3d9e8a',
            }}
          >
            {loading ? '验证中...' : '进入 MindOS'}
          </button>
        </form>
      </div>
    </div>
  );
}
