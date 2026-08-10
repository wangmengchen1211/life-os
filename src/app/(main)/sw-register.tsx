'use client';
import { useEffect } from 'react';

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    // 仅生产环境注册 SW，开发模式下避免缓存旧页面导致看不到最新代码
    if (process.env.NODE_ENV !== 'production') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW 注册失败不影响使用
      });
    }
  }, []);
  return null;
}
