import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/** 安全响应头：防降级、防点击劫持、防 MIME 嗅探、限制敏感权限 */
const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const { pathname } = request.nextUrl;

  // 公开路径（无需登录）
  const publicPaths = [
    '/login',
    '/privacy-policy',
    '/api/feishu/oauth/callback',
    '/_next',
    '/favicon.ico',
    '/icons',
    '/manifest',
    '/sw.js',
    '/workbox-',
  ];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  // 未登录用户访问受保护页面 → 重定向到登录页
  if (!user && !isPublic) {
    if (pathname.startsWith('/api/')) {
      return applySecurityHeaders(
        NextResponse.json({ error: '未登录' }, { status: 401 }),
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return applySecurityHeaders(NextResponse.redirect(url));
  }

  // 已登录用户访问登录页 → 重定向到主页
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return applySecurityHeaders(NextResponse.redirect(url));
  }

  return applySecurityHeaders(supabaseResponse);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest|sw.js|workbox-).*)'],
};
