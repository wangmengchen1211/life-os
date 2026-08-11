import { createBrowserClient } from '@supabase/ssr';

/**
 * 浏览器端 Supabase client
 * 使用 publishable key，配合 RLS 策略保护数据安全
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
