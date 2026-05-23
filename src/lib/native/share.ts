'use client';

/**
 * 分享与外部浏览器服务
 * 在原生平台使用系统分享面板和外部浏览器
 * Web 平台使用 Web Share API 或 window.open 降级
 */

import { isNativePlatform } from '@/lib/utils/platform';

/**
 * 在系统浏览器中打开 URL（不在 WebView 内打开）
 */
export async function openInBrowser(url: string): Promise<void> {
  if (isNativePlatform()) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url, presentationStyle: 'popover' });
      return;
    } catch (error) {
      console.warn('Browser plugin failed:', error);
    }
  }

  // Web fallback
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * 调用系统分享面板
 */
export async function shareContent(options: {
  title?: string;
  text?: string;
  url?: string;
}): Promise<boolean> {
  if (isNativePlatform()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({
        title: options.title,
        text: options.text,
        url: options.url,
        dialogTitle: '分享到...',
      });
      return true;
    } catch {
      // 用户取消分享不算错误
      return false;
    }
  }

  // Web Share API fallback
  if (navigator.share) {
    try {
      await navigator.share(options);
      return true;
    } catch {
      return false;
    }
  }

  // 最终降级：复制到剪贴板
  const text = options.url || options.text || '';
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
