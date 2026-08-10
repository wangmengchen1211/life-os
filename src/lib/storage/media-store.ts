import { openDB, type IDBPDatabase } from 'idb';
import { notifyUpsert, notifyDelete } from '@/lib/sync/cloud';

// ─── Types ───────────────────────────────────────────────────────────────────

export type Platform = 'wechat' | 'xiaohongshu' | 'zhihu' | 'juejin' | 'douyin' | 'other';

export interface MediaConfig {
  id?: number; // auto-increment
  /** 云端 UUID（Supabase 同步用） */
  cloudId?: string;
  platform: Platform;
  rssUrl: string;
  nickname: string;
  lastSyncAt?: string; // ISO timestamp
  lastSyncStatus?: 'success' | 'fail';
  createdAt: string; // ISO timestamp
}

export interface SyncLog {
  id?: number; // auto-increment
  /** 云端 UUID（Supabase 同步用） */
  cloudId?: string;
  configId: number;
  status: 'success' | 'fail';
  itemsCount: number;
  errorMsg?: string;
  syncAt: string; // ISO timestamp
}

// ─── Database ────────────────────────────────────────────────────────────────

const DB_NAME = 'media-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase | null = null;

export async function initDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // configs store
      const configsStore = db.createObjectStore('configs', {
        keyPath: 'id',
        autoIncrement: true,
      });
      configsStore.createIndex('by-platform', 'platform');

      // sync_logs store
      const logsStore = db.createObjectStore('sync_logs', {
        keyPath: 'id',
        autoIncrement: true,
      });
      logsStore.createIndex('by-config', 'configId');
      logsStore.createIndex('by-sync-at', 'syncAt');
    },
  });

  return dbInstance;
}

// ─── Configs CRUD ───────────────────────────────────────────────────────────

export async function addConfig(
  config: Omit<MediaConfig, 'id' | 'createdAt'> & Partial<Pick<MediaConfig, 'createdAt'>>
): Promise<number> {
  const db = await initDB();
  const record: MediaConfig = {
    ...config,
    createdAt: config.createdAt || new Date().toISOString(),
  };
  const id = await db.add('configs', record);
  notifyUpsert('media_configs', id as number);
  return id as number;
}

export async function listConfigs(): Promise<MediaConfig[]> {
  const db = await initDB();
  return db.getAll('configs');
}

export async function updateConfig(
  id: number,
  updates: Partial<Omit<MediaConfig, 'id'>>
): Promise<void> {
  const db = await initDB();
  const existing = await db.get('configs', id);
  if (!existing) throw new Error(`Config ${id} not found`);

  const updated: MediaConfig = {
    ...existing,
    ...updates,
    id,
  };
  await db.put('configs', updated);
  notifyUpsert('media_configs', id);
}

export async function deleteConfig(id: number): Promise<void> {
  const db = await initDB();
  const existing = await db.get('configs', id);
  // 级联删除关联同步日志
  const logs: SyncLog[] = await db.getAllFromIndex('sync_logs', 'by-config', id);
  const tx = db.transaction(['configs', 'sync_logs'], 'readwrite');
  await tx.objectStore('configs').delete(id);
  for (const log of logs) {
    if (log.id) await tx.objectStore('sync_logs').delete(log.id);
  }
  await tx.done;

  // 同步删除云端
  notifyDelete('media_configs', existing?.cloudId);
  for (const log of logs) {
    notifyDelete('media_sync_logs', log.cloudId);
  }
}

// ─── Sync Logs ──────────────────────────────────────────────────────────────

export async function addSyncLog(
  log: Omit<SyncLog, 'id' | 'syncAt'> & Partial<Pick<SyncLog, 'syncAt'>>
): Promise<number> {
  const db = await initDB();
  const record: SyncLog = {
    ...log,
    syncAt: log.syncAt || new Date().toISOString(),
  };
  const id = await db.add('sync_logs', record);
  notifyUpsert('media_sync_logs', id as number);
  return id as number;
}

export async function getRecentLogs(configId?: number, limit: number = 10): Promise<SyncLog[]> {
  const db = await initDB();
  let items: SyncLog[];

  if (configId !== undefined) {
    items = await db.getAllFromIndex('sync_logs', 'by-config', configId);
  } else {
    items = await db.getAll('sync_logs');
  }

  // Sort by syncAt descending (most recent first)
  items.sort((a, b) => b.syncAt.localeCompare(a.syncAt));
  return items.slice(0, limit);
}

export async function getLastSyncTime(): Promise<string | null> {
  const db = await initDB();
  const configs: MediaConfig[] = await db.getAll('configs');

  const syncTimes = configs
    .map((c) => c.lastSyncAt)
    .filter((t): t is string => !!t);

  if (syncTimes.length === 0) return null;

  syncTimes.sort((a, b) => b.localeCompare(a));
  return syncTimes[0];
}
