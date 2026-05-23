'use client';

/**
 * Capacitor 平台检测工具
 * 用于判断当前运行环境，实现平台特定行为
 */

let _isNative: boolean | null = null;
let _platform: string | null = null;

/**
 * 判断是否在原生平台（iOS/Android）中运行
 */
export function isNativePlatform(): boolean {
  if (_isNative !== null) return _isNative;
  
  try {
    // 动态导入避免 SSR 报错
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Capacitor } = require('@capacitor/core');
    _isNative = Capacitor.isNativePlatform();
  } catch {
    _isNative = false;
  }
  
  return _isNative!;
}

/**
 * 获取当前平台标识
 * @returns 'ios' | 'android' | 'web'
 */
export function getPlatform(): 'ios' | 'android' | 'web' {
  if (_platform !== null) return _platform as 'ios' | 'android' | 'web';
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Capacitor } = require('@capacitor/core');
    _platform = Capacitor.getPlatform();
  } catch {
    _platform = 'web';
  }
  
  return _platform as 'ios' | 'android' | 'web';
}

/**
 * 判断是否为 iOS 平台
 */
export function isIOS(): boolean {
  return getPlatform() === 'ios';
}

/**
 * 判断是否为 Android 平台
 */
export function isAndroid(): boolean {
  return getPlatform() === 'android';
}
