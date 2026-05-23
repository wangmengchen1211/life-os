import { SessionOptions } from 'iron-session';

export interface SessionData {
  isLoggedIn: boolean;
}

// 运行时校验：SESSION_SECRET 缺失会导致 iron-session 在中间件中崩溃（500 MIDDLEWARE_INVOCATION_FAILED）
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  console.error(
    `[session] SESSION_SECRET 未配置或不足 32 字符（当前长度: ${sessionSecret?.length ?? 0}），中间件将无法正常工作。`,
    `请在 Vercel 项目设置 → Environment Variables 中添加 SESSION_SECRET。`
  );
}

export const sessionOptions: SessionOptions = {
  password: sessionSecret || 'fallback-insecure-secret-at-least-32-chars',
  cookieName: 'mindos-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
  },
};

export const defaultSession: SessionData = {
  isLoggedIn: false,
};

// 判断是否为移动端 APP 的请求
export function isMobileApp(userAgent?: string | null): boolean {
  if (!userAgent) return false;
  // Capacitor Android WebView 的 UA 包含自定义 "MindOS-App" 标识
  // 或 Android WebView 标记 "wv"
  return userAgent.includes('MindOS-App') ||
    (userAgent.includes('Android') && userAgent.includes('wv'));
}

// 获取基于请求 User-Agent 的 session 配置
export function getSessionOptions(userAgent?: string | null): SessionOptions {
  if (isMobileApp(userAgent)) {
    return {
      ...sessionOptions,
      cookieOptions: {
        ...sessionOptions.cookieOptions,
        maxAge: 60 * 60 * 24 * 30, // 30 天
      },
    };
  }
  return sessionOptions;
}
