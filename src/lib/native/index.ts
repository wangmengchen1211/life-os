'use client';

/**
 * 原生能力统一初始化入口
 * 在应用启动时调用，自动检测平台并初始化对应服务
 */

export { hapticImpact, hapticNotification, hapticSelection, HapticStyle } from './haptics';
export { initAppLifecycle, onResume, onPause, onBackButton, onAppUrlOpen } from './app-lifecycle';
export { requestNotificationPermission, scheduleNotification, cancelNotification, cancelAllNotifications } from './notifications';
export { openInBrowser, shareContent } from './share';
export { initNetworkListener, onNetworkChange, getNetworkStatus, isOnline } from './network';
export type { NetworkStatus } from './network';

/**
 * 初始化所有原生服务
 * 应在应用根组件挂载时调用
 */
export async function initNativeServices(): Promise<void> {
  const { isNativePlatform } = await import('@/lib/utils/platform');
  
  if (!isNativePlatform()) {
    console.log('[Native] Running on web, skipping native initialization');
    return;
  }

  console.log('[Native] Initializing native services...');

  // 初始化应用生命周期监听
  const { initAppLifecycle } = await import('./app-lifecycle');
  await initAppLifecycle();

  // 状态栏初始化（如果安装了 status-bar 插件）
  try {
    const { initStatusBar } = await import('./status-bar');
    await initStatusBar();
  } catch {
    // status-bar 可能未安装
  }

  // 键盘初始化（如果安装了 keyboard 插件）
  try {
    const { initKeyboard } = await import('./keyboard');
    await initKeyboard();
  } catch {
    // keyboard 可能未安装
  }

  // 初始化网络状态监听
  const { initNetworkListener } = await import('./network');
  await initNetworkListener();

  console.log('[Native] Native services initialized');
}
