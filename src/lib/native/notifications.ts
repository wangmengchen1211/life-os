'use client';

/**
 * 本地通知服务
 * 在原生平台调度本地通知（Todo 提醒、写日记提醒等）
 * Web 平台使用 Notification API 降级
 */

import { isNativePlatform } from '@/lib/utils/platform';

export interface LocalNotificationOptions {
  id: number;
  title: string;
  body: string;
  /** 触发时间，ISO 字符串或 Date */
  scheduledAt?: Date | string;
  /** 额外数据 */
  extra?: Record<string, string>;
}

/**
 * 请求通知权限
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const result = await LocalNotifications.requestPermissions();
      return result.display === 'granted';
    } catch {
      return false;
    }
  }

  // Web fallback
  if ('Notification' in window) {
    const result = await Notification.requestPermission();
    return result === 'granted';
  }
  return false;
}

/**
 * 调度本地通知
 */
export async function scheduleNotification(options: LocalNotificationOptions): Promise<void> {
  if (isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const schedule: Record<string, unknown> = {};
      
      if (options.scheduledAt) {
        const date = options.scheduledAt instanceof Date 
          ? options.scheduledAt 
          : new Date(options.scheduledAt);
        schedule.at = date;
      }

      await LocalNotifications.schedule({
        notifications: [{
          id: options.id,
          title: options.title,
          body: options.body,
          schedule: Object.keys(schedule).length > 0 ? schedule : undefined,
          extra: options.extra,
        }],
      });
    } catch (error) {
      console.warn('Failed to schedule notification:', error);
    }
    return;
  }

  // Web fallback - 立即显示（不支持定时）
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(options.title, { body: options.body });
  }
}

/**
 * 取消指定通知
 */
export async function cancelNotification(id: number): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch (error) {
    console.warn('Failed to cancel notification:', error);
  }
}

/**
 * 取消所有待发通知
 */
export async function cancelAllNotifications(): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
  } catch (error) {
    console.warn('Failed to cancel all notifications:', error);
  }
}
