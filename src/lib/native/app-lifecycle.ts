'use client';

/**
 * 应用生命周期管理服务
 * 监听前后台切换、深度链接、返回按钮等原生事件
 */

import { isNativePlatform } from '@/lib/utils/platform';

type LifecycleCallback = () => void;
type URLCallback = (url: string) => void;

const listeners: {
  resume: LifecycleCallback[];
  pause: LifecycleCallback[];
  backButton: LifecycleCallback[];
  appUrlOpen: URLCallback[];
} = {
  resume: [],
  pause: [],
  backButton: [],
  appUrlOpen: [],
};

let initialized = false;

/**
 * 初始化应用生命周期监听
 * 应在应用启动时调用一次
 */
export async function initAppLifecycle(): Promise<void> {
  if (!isNativePlatform() || initialized) return;
  initialized = true;

  try {
    const { App } = await import('@capacitor/app');

    // 应用从后台恢复
    await App.addListener('resume', () => {
      listeners.resume.forEach(cb => cb());
    });

    // 应用进入后台
    await App.addListener('pause', () => {
      listeners.pause.forEach(cb => cb());
    });

    // Android 返回按钮
    await App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else if (listeners.backButton.length > 0) {
        listeners.backButton.forEach(cb => cb());
      } else {
        App.exitApp();
      }
    });

    // 深度链接
    await App.addListener('appUrlOpen', ({ url }) => {
      listeners.appUrlOpen.forEach(cb => cb(url));
    });
  } catch (error) {
    console.warn('App lifecycle initialization failed:', error);
  }
}

/**
 * 注册生命周期事件回调
 */
export function onResume(callback: LifecycleCallback): () => void {
  listeners.resume.push(callback);
  return () => {
    listeners.resume = listeners.resume.filter(cb => cb !== callback);
  };
}

export function onPause(callback: LifecycleCallback): () => void {
  listeners.pause.push(callback);
  return () => {
    listeners.pause = listeners.pause.filter(cb => cb !== callback);
  };
}

export function onBackButton(callback: LifecycleCallback): () => void {
  listeners.backButton.push(callback);
  return () => {
    listeners.backButton = listeners.backButton.filter(cb => cb !== callback);
  };
}

export function onAppUrlOpen(callback: URLCallback): () => void {
  listeners.appUrlOpen.push(callback);
  return () => {
    listeners.appUrlOpen = listeners.appUrlOpen.filter(cb => cb !== callback);
  };
}
