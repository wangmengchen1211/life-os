'use client';

import { useEffect, useRef } from 'react';
import { ensureSyncListener, syncAllModules } from '@/lib/sync/modules';

/**
 * 云同步触发器（挂在主布局中）
 * - 挂载时安装本地变更监听（store 写操作 → 云端推送）
 * - 每个会话触发一次全量双向合并（登录后本地数据 ↔ 云端）
 */
export function SyncProvider() {
  const syncedRef = useRef(false);

  useEffect(() => {
    ensureSyncListener();
    if (syncedRef.current) return;
    syncedRef.current = true;
    void syncAllModules();
  }, []);

  return null;
}
