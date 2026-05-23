'use client';

import { isNativePlatform, getPlatform } from '@/lib/utils/platform';

/**
 * 状态栏管理服务
 * 在原生平台设置状态栏样式，Web 平台静默降级
 */
export async function initStatusBar(): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    
    // 设置状态栏样式
    await StatusBar.setStyle({ style: Style.Light });
    
    // Android 设置状态栏背景色（透明，让内容延伸到状态栏下方）
    if (getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#00000000' });
      await StatusBar.setOverlaysWebView({ overlay: true });
    }
  } catch (error) {
    console.warn('StatusBar initialization failed:', error);
  }
}

/**
 * 隐藏状态栏（全屏模式）
 */
export async function hideStatusBar(): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    const { StatusBar } = await import('@capacitor/status-bar');
    await StatusBar.hide();
  } catch (error) {
    console.warn('StatusBar hide failed:', error);
  }
}

/**
 * 显示状态栏
 */
export async function showStatusBar(): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    const { StatusBar } = await import('@capacitor/status-bar');
    await StatusBar.show();
  } catch (error) {
    console.warn('StatusBar show failed:', error);
  }
}
