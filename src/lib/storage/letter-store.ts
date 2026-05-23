/**
 * @deprecated 此模块已被 mindlog-store 替代。保留仅为兼容已有数据。
 * 新功能请使用 src/lib/storage/mindlog-store.ts
 */
import { openDB, type IDBPDatabase } from 'idb';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MonthlyStats {
  diaryCount: number;
  knowledgeCount: number;
  todoCompleted: number;
  moodSummary: string[]; // 本月出现最多的情绪标签
}

export interface Letter {
  id?: number; // auto-increment
  periodMonth: string; // YYYY-MM 格式
  title: string;
  content: string;
  monthlyStats: MonthlyStats;
  createdAt: string; // ISO timestamp
}

// ─── Database ────────────────────────────────────────────────────────────────

const DB_NAME = 'letter-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase | null = null;

export async function initDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const lettersStore = db.createObjectStore('letters', {
        keyPath: 'id',
        autoIncrement: true,
      });
      lettersStore.createIndex('by-month', 'periodMonth', { unique: true });
      lettersStore.createIndex('by-created', 'createdAt');
    },
  });

  return dbInstance;
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function addLetter(
  letter: Omit<Letter, 'id' | 'createdAt'> & Partial<Pick<Letter, 'createdAt'>>
): Promise<number> {
  const db = await initDB();
  const record: Letter = {
    ...letter,
    createdAt: letter.createdAt || new Date().toISOString(),
  };
  const id = await db.add('letters', record);
  return id as number;
}

export async function getLetter(id: number): Promise<Letter | undefined> {
  const db = await initDB();
  return db.get('letters', id);
}

export async function getLetterByMonth(month: string): Promise<Letter | undefined> {
  const db = await initDB();
  return db.getFromIndex('letters', 'by-month', month);
}

export async function getLatestLetter(): Promise<Letter | undefined> {
  const db = await initDB();
  const tx = db.transaction('letters', 'readonly');
  const index = tx.store.index('by-created');
  const cursor = await index.openCursor(null, 'prev');
  await tx.done;
  return cursor?.value;
}

export async function listLetters(): Promise<Letter[]> {
  const db = await initDB();
  const items: Letter[] = await db.getAll('letters');
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return items;
}

export async function deleteLetter(id: number): Promise<void> {
  const db = await initDB();
  await db.delete('letters', id);
}

export async function upsertLetter(
  letter: Omit<Letter, 'id' | 'createdAt'> & Partial<Pick<Letter, 'createdAt'>>
): Promise<number> {
  const db = await initDB();
  const existing = await getLetterByMonth(letter.periodMonth);

  if (existing) {
    const updated: Letter = {
      ...existing,
      ...letter,
      id: existing.id,
      createdAt: existing.createdAt,
    };
    await db.put('letters', updated);
    return existing.id as number;
  } else {
    return addLetter(letter);
  }
}

export async function getLetterCount(): Promise<number> {
  const db = await initDB();
  return db.count('letters');
}
