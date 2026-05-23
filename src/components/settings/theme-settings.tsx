'use client';
import { useState, useEffect } from 'react';
import { getUserProfile, saveUserProfile } from '@/lib/storage/profile-store';

type ThemeMode = 'auto' | 'light' | 'dark';

export function ThemeSettings() {
  const [mode, setMode] = useState<ThemeMode>('auto');

  useEffect(() => {
    getUserProfile().then(p => {
      setMode(p.themeMode || 'auto');
    });
  }, []);

  const handleChange = async (newMode: ThemeMode) => {
    setMode(newMode);
    await saveUserProfile({ themeMode: newMode });
    // 立即应用主题
    if (newMode === 'auto') {
      document.documentElement.removeAttribute('data-theme-override');
    } else {
      document.documentElement.setAttribute('data-theme-override', newMode);
    }
  };

  const options: { value: ThemeMode; label: string; desc: string }[] = [
    { value: 'auto', label: '跟随时间', desc: '日出日落自然切换' },
    { value: 'light', label: '始终浅色', desc: '保持清爽明亮' },
    { value: 'dark', label: '始终深色', desc: '柔和夜间模式' },
  ];

  return (
    <section className="bg-white/60 backdrop-blur-sm border border-black/5 rounded-2xl p-6">
      <h2 className="text-lg font-light text-gray-700 mb-4">外观偏好</h2>
      <div className="grid grid-cols-3 gap-3">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => handleChange(opt.value)}
            className={`p-3 rounded-xl border text-left transition-all ${
              mode === opt.value
                ? 'border-[#80cbc4] bg-[#80cbc4]/10'
                : 'border-black/5 hover:border-black/10'
            }`}
          >
            <p className="text-sm font-medium text-gray-700">{opt.label}</p>
            <p className="text-xs text-gray-400 mt-1">{opt.desc}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
