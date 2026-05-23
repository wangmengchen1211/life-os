import { openDB, type IDBPDatabase } from 'idb';
import { listEntries } from './diary-store';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProfileStats {
  diaryCount: number;
  knowledgeCount: number;
  todoCompleted: number;
  todoTotal: number;
  mindlogCount: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function countStore(dbName: string, storeName: string): Promise<number> {
  let db: IDBPDatabase | null = null;
  try {
    db = await openDB(dbName, undefined, {
      blocked() {
        console.warn(`[stats] openDB('${dbName}') blocked by another connection`);
      },
    });
    if (!db.objectStoreNames.contains(storeName)) {
      return 0;
    }
    return await db.count(storeName);
  } catch {
    return 0;
  } finally {
    if (db) db.close();
  }
}

async function countCompletedTodos(): Promise<{ completed: number; total: number }> {
  let db: IDBPDatabase | null = null;
  try {
    db = await openDB('todo-db', undefined, {
      blocked() {
        console.warn('[stats] openDB(todo-db) blocked by another connection');
      },
    });
    if (!db.objectStoreNames.contains('todos')) {
      return { completed: 0, total: 0 };
    }
    const all = await db.getAll('todos');
    const completed = all.filter(
      (t: { isCompleted?: boolean }) => t.isCompleted
    ).length;
    return { completed, total: all.length };
  } catch {
    return { completed: 0, total: 0 };
  } finally {
    if (db) db.close();
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

export async function getProfileStats(): Promise<ProfileStats> {
  const [diaryEntries, knowledgeCount, todoResult, mindlogCount] =
    await Promise.all([
      listEntries(),
      countStore('knowledge-db', 'items'),
      countCompletedTodos(),
      countStore('mindlog-db', 'entries'),
    ]);

  return {
    diaryCount: diaryEntries.length,
    knowledgeCount,
    todoCompleted: todoResult.completed,
    todoTotal: todoResult.total,
    mindlogCount,
  };
}
