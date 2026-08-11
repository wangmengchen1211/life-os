'use client';

import { useEffect, useRef } from 'react';
import { ensureSyncListener, syncAllModules } from '@/lib/sync/modules';
import { createClient } from '@/lib/supabase/client';

/**
 * 云同步触发器（挂在主布局中）
 * - 挂载时安装本地变更监听（store 写操作 → 云端推送）
 * - 监听 auth state 变化：session 就绪后触发全量双向合并
 *   （解决从 /login 跳转后 session 异步初始化导致首次同步拿不到 userId 的问题）
 * - 同一 userId 同一会话只同步一次；切换账号后重新同步
 */
export function SyncProvider() {
  // 记录已为哪个 userId 完成过同步（支持切换账号后重新同步）
  const syncedForUser = useRef<string | null>(null);

  useEffect(() => {
    ensureSyncListener();
    const supabase = createClient();

    /** 尝试同步：session 就绪时触发，同一 userId 不重复 */
    const trySync = async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id ?? null;
      if (!uid) return;
      if (syncedForUser.current === uid) return;
      syncedForUser.current = uid;
      await syncAllModules();
    };

    // 初始尝试（页面刷新时 session 可能已在 cookie 中）
    void trySync();

    // 监听 auth state 变化：覆盖「登录后 session 异步就绪」的时序问题
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') &&
        session
      ) {
        const uid = session.user.id;
        if (syncedForUser.current === uid) return;
        syncedForUser.current = uid;
        void syncAllModules();
      } else if (event === 'SIGNED_OUT') {
        syncedForUser.current = null;
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return null;
}
