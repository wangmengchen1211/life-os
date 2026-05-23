import { openDB, type IDBPDatabase } from 'idb';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DiaryEntry {
  id?: number;
  content: string;
  moodTags: string[];
  keyThemes: string[];
  aiFeedback?: string;
  images?: string[]; // base64 压缩后的图片，最多 8 张
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DiarySummary {
  id?: number;
  periodType: 'week' | 'month';
  periodStart: string;
  periodEnd: string;
  summaryContent: string;
  emotionTrend?: any;
  keywordCloud?: any;
  createdAt: string;
}

export interface ListEntriesOptions {
  offset?: number;
  limit?: number;
}

export interface DiaryStats {
  weekCount: number;
  totalCount: number;
  latestMood: string[];
}

// ─── Database ────────────────────────────────────────────────────────────────

const DB_NAME = 'diary-db';
const DB_VERSION = 3;

let dbInstance: IDBPDatabase | null = null;

export async function initDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // entries store
      if (!db.objectStoreNames.contains('entries')) {
        const entriesStore = db.createObjectStore('entries', {
          keyPath: 'id',
          autoIncrement: true,
        });
        entriesStore.createIndex('by-created', 'createdAt');
        entriesStore.createIndex('by-mood', 'moodTags', { multiEntry: true });
      }

      // summaries store
      if (!db.objectStoreNames.contains('summaries')) {
        const summariesStore = db.createObjectStore('summaries', {
          keyPath: 'id',
          autoIncrement: true,
        });
        summariesStore.createIndex('by-period', 'periodType');
        summariesStore.createIndex('by-start', 'periodStart');
      }

      // v2→v3: 给已有 entries 补充 images 字段
      if (oldVersion < 3 && db.objectStoreNames.contains('entries')) {
        // 无需额外操作，新字段为可选，读取时自动为 undefined
      }
    },
    blocked() {
      console.warn('[diary-db] Version upgrade blocked by another connection');
    },
  });

  return dbInstance;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diff);
  return d;
}

// ─── Entries CRUD ────────────────────────────────────────────────────────────

export async function addEntry(
  entry: Omit<DiaryEntry, 'id' | 'wordCount' | 'createdAt' | 'updatedAt'> &
    Partial<Pick<DiaryEntry, 'createdAt' | 'updatedAt' | 'wordCount'>>
): Promise<number> {
  const db = await initDB();
  const now = new Date().toISOString();
  const record: DiaryEntry = {
    ...entry,
    wordCount: entry.content.length,
    createdAt: entry.createdAt || now,
    updatedAt: entry.updatedAt || now,
  };
  const id = await db.add('entries', record);
  return id as number;
}

export async function getEntry(id: number): Promise<DiaryEntry | undefined> {
  const db = await initDB();
  return db.get('entries', id);
}

export async function updateEntry(
  id: number,
  updates: Partial<Omit<DiaryEntry, 'id'>>
): Promise<void> {
  const db = await initDB();
  const existing = await db.get('entries', id);
  if (!existing) throw new Error(`Entry ${id} not found`);

  const updated: DiaryEntry = {
    ...existing,
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };
  // Recalculate wordCount if content changed
  if (updates.content !== undefined) {
    updated.wordCount = updates.content.length;
  }
  await db.put('entries', updated);
}

export async function deleteEntry(id: number): Promise<void> {
  const db = await initDB();
  await db.delete('entries', id);
}

export async function listEntries(options?: ListEntriesOptions): Promise<DiaryEntry[]> {
  const db = await initDB();
  const items: DiaryEntry[] = await db.getAll('entries');

  // Sort by createdAt descending
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Pagination
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? items.length;
  return items.slice(offset, offset + limit);
}

export async function getWeekEntries(): Promise<DiaryEntry[]> {
  const db = await initDB();
  const monday = getMonday(new Date());
  const mondayISO = monday.toISOString();

  const items: DiaryEntry[] = await db.getAll('entries');
  return items
    .filter((entry) => entry.createdAt >= mondayISO)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getRecentEntries(days: number): Promise<DiaryEntry[]> {
  const db = await initDB();
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);
  const sinceISO = since.toISOString();

  const items: DiaryEntry[] = await db.getAll('entries');
  return items
    .filter((entry) => entry.createdAt >= sinceISO)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getWeekCount(): Promise<number> {
  const entries = await getWeekEntries();
  return entries.length;
}

export async function getStats(): Promise<DiaryStats> {
  const db = await initDB();
  const items: DiaryEntry[] = await db.getAll('entries');

  // Week count
  const monday = getMonday(new Date());
  const mondayISO = monday.toISOString();
  const weekCount = items.filter((entry) => entry.createdAt >= mondayISO).length;

  // Latest mood
  let latestMood: string[] = [];
  if (items.length > 0) {
    const sorted = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    latestMood = sorted[0].moodTags;
  }

  return {
    weekCount,
    totalCount: items.length,
    latestMood,
  };
}

// ─── Summaries CRUD ──────────────────────────────────────────────────────────

export async function addSummary(
  summary: Omit<DiarySummary, 'id' | 'createdAt'> & Partial<Pick<DiarySummary, 'createdAt'>>
): Promise<number> {
  const db = await initDB();
  const record: DiarySummary = {
    ...summary,
    createdAt: summary.createdAt || new Date().toISOString(),
  };
  const id = await db.add('summaries', record);
  return id as number;
}

export async function listSummaries(periodType?: 'week' | 'month'): Promise<DiarySummary[]> {
  const db = await initDB();

  let items: DiarySummary[];
  if (periodType) {
    items = await db.getAllFromIndex('summaries', 'by-period', periodType);
  } else {
    items = await db.getAll('summaries');
  }

  // Sort by periodStart descending
  items.sort((a, b) => b.periodStart.localeCompare(a.periodStart));
  return items;
}
