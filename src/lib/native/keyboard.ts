'use client';

import { isNativePlatform } from '@/lib/utils/platform';

/**
 * 键盘管理服务
 * 处理原生键盘弹出时的视图调整
 */
export async function initKeyboard(): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');
    
    // 设置键盘行为：调整视图大小而非推动内容
    await Keyboard.setResizeMode({ mode: KeyboardResize.Ionic });
    
    // 键盘弹出时滚动到输入框
    await Keyboard.setScroll({ isDisabled: false });
  } catch (error) {
    console.warn('Keyboard initialization failed:', error);
  }
}
