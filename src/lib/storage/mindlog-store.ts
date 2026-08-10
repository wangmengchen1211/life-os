import { openDB, type IDBPDatabase } from 'idb';
import { notifyUpsert } from '@/lib/sync/cloud';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MindLogEntry {
  id?: number;
  /** 云端 UUID（Supabase 同步用） */
  cloudId?: string;
  type: 'daily' | 'weekly' | 'monthly';
  periodStart: string;   // ISO date string (YYYY-MM-DD)
  periodEnd: string;     // ISO date string (YYYY-MM-DD)
  keywords: string;      // 核心关键词（如 "灰调·重连"）
  content: string;       // 完整 mindlog 结构化文本
  dashboardSummary: string; // 仪表盘简短总结文本
  sourceData: {
    diaryCount: number;
    knowledgeCount: number;
    moodSummary: string;
  };
  createdAt: string;     // ISO datetime
}

// ─── Database ────────────────────────────────────────────────────────────────

const DB_NAME = 'mindlog-db';
const DB_VERSION = 2;

let dbInstance: IDBPDatabase | null = null;

export async function initDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('entries')) {
        const store = db.createObjectStore('entries', {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('by-type', 'type');
        store.createIndex('by-period', ['type', 'periodStart'], { unique: true });
        store.createIndex('by-created', 'createdAt');
      }
    },
  });

  return dbInstance;
}

// ─── Core Functions ─────────────────────────────────────────────────────────

export async function addEntry(entry: Omit<MindLogEntry, 'id'>): Promise<number> {
  const db = await initDB();
  const id = await db.add('entries', entry);
  notifyUpsert('mindlog_reports', id as number);
  return id as number;
}

export async function getEntry(id: number): Promise<MindLogEntry | undefined> {
  const db = await initDB();
  return db.get('entries', id);
}

export async function getLatestByType(type: MindLogEntry['type']): Promise<MindLogEntry | undefined> {
  const db = await initDB();
  const items: MindLogEntry[] = await db.getAllFromIndex('entries', 'by-type', type);
  if (items.length === 0) return undefined;
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return items[0];
}

export async function listByType(type: MindLogEntry['type'], limit?: number): Promise<MindLogEntry[]> {
  const db = await initDB();
  const items: MindLogEntry[] = await db.getAllFromIndex('entries', 'by-type', type);
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (limit !== undefined) {
    return items.slice(0, limit);
  }
  return items;
}

export async function getByPeriod(type: MindLogEntry['type'], periodStart: string): Promise<MindLogEntry | undefined> {
  const db = await initDB();
  return db.getFromIndex('entries', 'by-period', [type, periodStart]);
}

export async function upsertEntry(entry: Omit<MindLogEntry, 'id'>): Promise<number> {
  const db = await initDB();
  const existing = await db.getFromIndex('entries', 'by-period', [entry.type, entry.periodStart]);
  if (existing) {
    const updated: MindLogEntry = { ...entry, id: existing.id };
    await db.put('entries', updated);
    notifyUpsert('mindlog_reports', existing.id as number);
    return existing.id as number;
  }
  const id = await db.add('entries', entry);
  notifyUpsert('mindlog_reports', id as number);
  return id as number;
}
