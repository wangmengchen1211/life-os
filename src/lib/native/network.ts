'use client';

/**
 * 网络状态监听服务
 * 原生平台使用 @capacitor/network 精确检测（WiFi/Cellular/None）
 * Web 平台使用 navigator.onLine 降级
 */

import { isNativePlatform } from '@/lib/utils/platform';

export type NetworkStatus = {
  connected: boolean;
  connectionType: 'wifi' | 'cellular' | 'none' | 'unknown';
};

type NetworkCallback = (status: NetworkStatus) => void;

const listeners: NetworkCallback[] = [];
let currentStatus: NetworkStatus = { connected: true, connectionType: 'unknown' };
let initialized = false;

/**
 * 获取当前网络状态
 */
export function getNetworkStatus(): NetworkStatus {
  return { ...currentStatus };
}

/**
 * 初始化网络监听
 */
export async function initNetworkListener(): Promise<void> {
  if (initialized) return;
  initialized = true;

  if (isNativePlatform()) {
    try {
      const { Network } = await import('@capacitor/network');
      
      // 获取初始状态
      const status = await Network.getStatus();
      currentStatus = {
        connected: status.connected,
        connectionType: status.connectionType as NetworkStatus['connectionType'],
      };

      // 监听变化
      await Network.addListener('networkStatusChange', (status) => {
        currentStatus = {
          connected: status.connected,
          connectionType: status.connectionType as NetworkStatus['connectionType'],
        };
        listeners.forEach(cb => cb(currentStatus));
      });
    } catch (error) {
      console.warn('Network plugin initialization failed:', error);
      fallbackToWebAPI();
    }
  } else {
    fallbackToWebAPI();
  }
}

/**
 * Web API 降级方案
 */
function fallbackToWebAPI(): void {
  currentStatus = {
    connected: navigator.onLine,
    connectionType: navigator.onLine ? 'unknown' : 'none',
  };

  window.addEventListener('online', () => {
    currentStatus = { connected: true, connectionType: 'unknown' };
    listeners.forEach(cb => cb(currentStatus));
  });

  window.addEventListener('offline', () => {
    currentStatus = { connected: false, connectionType: 'none' };
    listeners.forEach(cb => cb(currentStatus));
  });
}

/**
 * 注册网络状态变化回调
 * @returns 取消订阅函数
 */
export function onNetworkChange(callback: NetworkCallback): () => void {
  listeners.push(callback);
  return () => {
    const index = listeners.indexOf(callback);
    if (index > -1) listeners.splice(index, 1);
  };
}

/**
 * 判断当前是否联网
 */
export function isOnline(): boolean {
  return currentStatus.connected;
}
