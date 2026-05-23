import { openDB, type IDBPDatabase } from 'idb';

/**
 * 独立的小库：仅保存 Obsidian directory handle。
 * 不放进 knowledge-db，避免结构化克隆对象混入业务 store。
 */
const DB_NAME = 'vault-handle-db';
const DB_VERSION = 1;
const STORE = 'handles';
const KEY = 'obsidian-vault';

let dbInstance: IDBPDatabase | null = null;

async function initDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    },
  });
  return dbInstance;
}

export async function saveVaultHandle(handle: FileSystemDirectoryHandle, displayName?: string): Promise<void> {
  const db = await initDB();
  await db.put(STORE, { handle, displayName: displayName ?? handle.name, savedAt: new Date().toISOString() }, KEY);
}

export async function loadVaultHandle(): Promise<{ handle: FileSystemDirectoryHandle; displayName: string; savedAt: string } | null> {
  const db = await initDB();
  const rec = await db.get(STORE, KEY);
  return rec ?? null;
}

export async function clearVaultHandle(): Promise<void> {
  const db = await initDB();
  await db.delete(STORE, KEY);
}
