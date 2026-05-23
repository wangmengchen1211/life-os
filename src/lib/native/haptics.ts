'use client';

/**
 * 触觉反馈服务
 * 在原生平台提供触觉反馈，Web 平台静默降级
 */

import { isNativePlatform } from '@/lib/utils/platform';

export enum HapticStyle {
  Light = 'LIGHT',
  Medium = 'MEDIUM',
  Heavy = 'HEAVY',
}

/**
 * 触发冲击触觉反馈（轻触按钮时使用）
 */
export async function hapticImpact(style: HapticStyle = HapticStyle.Light): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    const styleMap = {
      [HapticStyle.Light]: ImpactStyle.Light,
      [HapticStyle.Medium]: ImpactStyle.Medium,
      [HapticStyle.Heavy]: ImpactStyle.Heavy,
    };
    await Haptics.impact({ style: styleMap[style] });
  } catch {
    // 静默降级
  }
}

/**
 * 触发通知触觉反馈（操作成功/完成时使用）
 */
export async function hapticNotification(type: 'success' | 'warning' | 'error' = 'success'): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    const typeMap = {
      success: NotificationType.Success,
      warning: NotificationType.Warning,
      error: NotificationType.Error,
    };
    await Haptics.notification({ type: typeMap[type] });
  } catch {
    // 静默降级
  }
}

/**
 * 触发选择触觉反馈（列表滚动选择时使用）
 */
export async function hapticSelection(): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    const { Haptics } = await import('@capacitor/haptics');
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  } catch {
    // 静默降级
  }
}
