import { openDB, type IDBPDatabase } from 'idb';
import { getUserId } from '@/lib/sync/cloud';
import { createClient } from '@/lib/supabase/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string; // 固定 'default'
  nickname: string;
  signature: string;
  themeMode?: 'auto' | 'light' | 'dark';
  updatedAt: number;
}

// ─── DB Config ───────────────────────────────────────────────────────────────

const DB_NAME = 'profile-db';
const STORE_NAME = 'profile';
const DB_VERSION = 1;

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
    blocked() {
      console.warn('[profile-db] Version upgrade blocked by another connection');
    },
  });
}

/** 导出给同步层使用 */
export const initDB = getDB;

// ─── Public API ──────────────────────────────────────────────────────────────

const DEFAULT_PROFILE: UserProfile = {
  id: 'default',
  nickname: '旅人',
  signature: '在心智的田野上，种下每一天',
  updatedAt: Date.now(),
};

export async function getUserProfile(): Promise<UserProfile> {
  let db: IDBPDatabase | null = null;
  try {
    db = await getDB();
    const profile = await db.get(STORE_NAME, 'default');
    return profile || { ...DEFAULT_PROFILE, updatedAt: Date.now() };
  } catch {
    return { ...DEFAULT_PROFILE, updatedAt: Date.now() };
  } finally {
    if (db) db.close();
  }
}

export async function saveUserProfile(
  data: Partial<Omit<UserProfile, 'id'>>,
): Promise<void> {
  let db: IDBPDatabase | null = null;
  let saved: UserProfile;
  try {
    db = await getDB();
    const existing =
      (await db.get(STORE_NAME, 'default')) || { ...DEFAULT_PROFILE, updatedAt: Date.now() };
    saved = { ...existing, ...data, updatedAt: Date.now() };
    await db.put(STORE_NAME, saved);
  } catch (e) {
    console.error('[profile-store] save failed:', e);
    return;
  } finally {
    if (db) db.close();
  }

  // 已登录时同步到云端（profiles.id = auth.uid()，直接 upsert）
  try {
    const userId = await getUserId();
    if (!userId) return;
    const supabase = createClient();
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      nickname: saved.nickname,
      signature: saved.signature,
      theme_mode: saved.themeMode ?? 'auto',
      updated_at: new Date().toISOString(),
    });
    if (error) console.warn('[profile-store] 云端保存失败:', error.message);
  } catch (e) {
    console.warn('[profile-store] 云端保存失败:', e);
  }
}
