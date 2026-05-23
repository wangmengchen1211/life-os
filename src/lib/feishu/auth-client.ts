/**
 * 飞书客户端认证助手：处理 token 过期自动刷新。
 * 使用方：UI 在发起导入前调用 `ensureFreshFeishuToken()` 拿到有效的 access_token。
 */

import {
  loadFeishuToken,
  saveFeishuToken,
  clearFeishuToken,
  type FeishuTokenRecord,
} from './token-crypto';

/** 剩余有效期少于此值则提前刷新（毫秒） */
const REFRESH_SAFETY_MS = 5 * 60 * 1000;

/**
 * 拿到一个有效的 user_access_token。
 * - 无记录 → 返回 null（UI 应引导用户去授权）
 * - access 未过期 → 直接返回
 * - access 过期但 refresh 未过期 → 自动刷新
 * - refresh 也过期 → 清空记录，返回 null
 */
export async function ensureFreshFeishuToken(): Promise<FeishuTokenRecord | null> {
  const rec = await loadFeishuToken();
  if (!rec) return null;

  const now = Date.now();
  const accessExpireAt = new Date(rec.accessExpiresAt).getTime();
  const refreshExpireAt = new Date(rec.refreshExpiresAt).getTime();

  if (accessExpireAt - now > REFRESH_SAFETY_MS) {
    return rec;
  }

  if (refreshExpireAt <= now) {
    await clearFeishuToken();
    return null;
  }

  try {
    const res = await fetch('/api/feishu/oauth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rec.refreshToken }),
    });
    if (!res.ok) {
      await clearFeishuToken();
      return null;
    }
    const fresh = (await res.json()) as FeishuTokenRecord;
    await saveFeishuToken(fresh);
    return fresh;
  } catch {
    return null;
  }
}

/** 是否已授权（不关心是否过期） */
export async function isFeishuAuthorized(): Promise<boolean> {
  const rec = await loadFeishuToken();
  return !!rec;
}
