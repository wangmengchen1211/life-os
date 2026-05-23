import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { SessionData, getSessionOptions } from '@/lib/auth/session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 不拦截的路径
  // 注意：/api/feishu/oauth/callback 必须公开——飞书 OAuth 跳回来时若 session 校验异常，
  // 返回 401 JSON 会让弹窗黑屏且无法回传 token。callback 自身用 state 做 CSRF 防护，
  // 且只返回 HTML 给弹窗让其 postMessage/localStorage 回传，token 的最终存储由主窗口（带 session）完成。
  const publicPaths = [
    '/login',
    '/privacy-policy',
    '/api/auth',
    '/api/feishu/oauth/callback',
    '/api/mirror/chat',
    '/api/mindlog/generate',
    '/api/daily-echo',
    '/api/diary/feedback',
    '/api/knowledge',
    '/api/ai/billing',
    '/_next',
    '/favicon.ico',
    '/icons',
    '/manifest',
  ];
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // 检查 session
  const response = NextResponse.next();
  const userAgent = request.headers.get('user-agent');
  const session = await getIronSession<SessionData>(request, response, getSessionOptions(userAgent));

  if (!session.isLoggedIn) {
    // API 路由返回 401 JSON，避免重定向导致 fetch 收到 HTML
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest).*)'],
};
