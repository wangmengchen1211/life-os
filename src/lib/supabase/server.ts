import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';

type ServerSupabaseClient = ReturnType<typeof createServerClient>;

/** 带超时的 fetch，避免 Supabase 不可达时长时间挂起 */
const fetchWithTimeout = (url: RequestInfo | URL, init?: RequestInit) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
};

/**
 * 获取当前登录用户（本地解析，零网络开销）
 * 使用 getSession() 直接从 cookie 的 JWT 解析用户，不发起远程请求
 * 数据安全由 RLS 保证
 */
export async function getAuthUser(
  supabase: ServerSupabaseClient,
): Promise<User | null> {
  (supabase.auth as unknown as { suppressGetSessionWarning: boolean }).suppressGetSessionWarning = true;
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

/**
 * 服务端 Supabase client
 * 从 cookies 中读取 auth session
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchWithTimeout },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component 中调用 set 会被忽略，middleware 会处理 cookie 刷新
          }
        },
      },
    },
  );
}