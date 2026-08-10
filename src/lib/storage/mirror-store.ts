import { openDB, type IDBPDatabase } from 'idb';
import { notifyUpsert, notifyDelete } from '@/lib/sync/cloud';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MirrorSession {
  id?: number;
  /** 云端 UUID（Supabase 同步用） */
  cloudId?: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface MirrorMessage {
  id?: number;
  /** 云端 UUID（Supabase 同步用） */
  cloudId?: string;
  sessionId?: number;
  role: 'user' | 'assistant';
  content: string;
  attachments?: { type: 'image' | 'file' | 'link'; name: string; data: string }[];
  createdAt: string;
}

// ─── Database ────────────────────────────────────────────────────────────────

const DB_NAME = 'mirror-db';
const DB_VERSION = 2;

let dbInstance: IDBPDatabase | null = null;

export async function initDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // v1 → v2: 添加 sessions 表 + messages 添加 sessionId 索引
      if (oldVersion < 1) {
        // 首次创建 messages 表
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', {
            keyPath: 'id',
            autoIncrement: true,
          });
          msgStore.createIndex('byCreatedAt', 'createdAt');
          msgStore.createIndex('by-session', 'sessionId');
        }
      } else if (oldVersion === 1) {
        // v1 → v2 升级：给 messages 添加 sessionId 索引
        if (db.objectStoreNames.contains('messages')) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const msgStore = (db as any).transaction('messages', 'readwrite').objectStore('messages');
          if (!msgStore.indexNames.contains('by-session')) {
            msgStore.createIndex('by-session', 'sessionId');
          }
        }
      }

      // 创建 sessions 表
      if (!db.objectStoreNames.contains('sessions')) {
        const sessionStore = db.createObjectStore('sessions', {
          keyPath: 'id',
          autoIncrement: true,
        });
        sessionStore.createIndex('by-updated', 'updatedAt');
      }
    },
  });

  return dbInstance;
}

// ─── Session Functions ───────────────────────────────────────────────────────

export async function createSession(title: string = '新对话'): Promise<number> {
  const db = await initDB();
  const now = new Date().toISOString();
  const id = await db.add('sessions', { title, createdAt: now, updatedAt: now });
  notifyUpsert('mirror_sessions', id as number);
  return id as number;
}

export async function listSessions(): Promise<MirrorSession[]> {
  const db = await initDB();
  const items: MirrorSession[] = await db.getAllFromIndex('sessions', 'by-updated');
  return items.reverse(); // 最近更新排前面
}

export async function getSession(id: number): Promise<MirrorSession | undefined> {
  const db = await initDB();
  return db.get('sessions', id);
}

export async function updateSession(id: number, updates: Partial<Omit<MirrorSession, 'id'>>): Promise<void> {
  const db = await initDB();
  const existing = await db.get('sessions', id);
  if (!existing) return;
  const updated = { ...existing, ...updates, id };
  await db.put('sessions', updated);
  notifyUpsert('mirror_sessions', id);
}

export async function deleteSession(id: number): Promise<void> {
  const db = await initDB();
  // 删除会话下所有消息
  const msgs = await listMessagesBySession(id);
  const session = await db.get('sessions', id);
  const tx = db.transaction(['sessions', 'messages'], 'readwrite');
  await tx.objectStore('sessions').delete(id);
  for (const msg of msgs) {
    if (msg.id) await tx.objectStore('messages').delete(msg.id);
  }
  await tx.done;

  // 同步删除云端会话与消息
  notifyDelete('mirror_sessions', session?.cloudId);
  for (const msg of msgs) {
    notifyDelete('mirror_messages', msg.cloudId);
  }
}

// ─── Message Functions ───────────────────────────────────────────────────────

export async function addMessage(msg: Omit<MirrorMessage, 'id'>): Promise<number> {
  const db = await initDB();
  const id = await db.add('messages', msg);

  // 如果有 sessionId，更新会话的 updatedAt
  if (msg.sessionId) {
    const session = await db.get('sessions', msg.sessionId);
    if (session) {
      // 用第一条用户消息作为标题（如果标题还是默认的）
      if (session.title === '新对话' && msg.role === 'user') {
        session.title = msg.content.slice(0, 30) + (msg.content.length > 30 ? '…' : '');
      }
      session.updatedAt = new Date().toISOString();
      await db.put('sessions', session);
      notifyUpsert('mirror_sessions', session.id!);
    }
  }

  notifyUpsert('mirror_messages', id as number);
  return id as number;
}

export async function listMessages(limit?: number): Promise<MirrorMessage[]> {
  const db = await initDB();
  const items: MirrorMessage[] = await db.getAllFromIndex('messages', 'byCreatedAt');
  if (limit !== undefined) {
    return items.slice(-limit);
  }
  return items;
}

export async function listMessagesBySession(sessionId: number): Promise<MirrorMessage[]> {
  const db = await initDB();
  const all: MirrorMessage[] = await db.getAllFromIndex('messages', 'by-session', sessionId);
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function clearMessages(): Promise<void> {
  const db = await initDB();
  await db.clear('messages');
}

export async function getMessageCount(): Promise<number> {
  const db = await initDB();
  return db.count('messages');
}
