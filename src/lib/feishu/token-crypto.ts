/**
 * 用户 access/refresh token 的本地加密存储（AES-GCM）。
 *
 * 密钥派生：SESSION_SECRET（服务端下发一次）→ SHA-256 → AES-GCM key。
 * 为避免把 SESSION_SECRET 暴露到前端，前端通过 `/api/feishu/oauth/url` 返回时
 * 附带一次性用途的派生盐，浏览器再按同样算法派生一致的 key。
 *
 * 简化策略：直接使用固定的本地常量盐 + 浏览器端 crypto.subtle，
 * 安全边界是「只要浏览器 IndexedDB 没被他人物理接触」，符合单用户本地 PWA 场景。
 */

const ENCRYPTION_SALT = 'mindos-feishu-token-v1';

async function deriveKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const material = enc.encode(ENCRYPTION_SALT + navigator.userAgent.slice(0, 64));
  const hash = await crypto.subtle.digest('SHA-256', material);
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export interface EncryptedBlob {
  iv: string; // base64
  data: string; // base64
}

export async function encryptJSON(value: unknown): Promise<EncryptedBlob> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(encoded)
  );
  return { iv: toBase64(iv), data: toBase64(new Uint8Array(cipher)) };
}

export async function decryptJSON<T = unknown>(blob: EncryptedBlob): Promise<T> {
  const key = await deriveKey();
  const iv = fromBase64(blob.iv);
  const data = fromBase64(blob.data);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(data)
  );
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

/** 把 Uint8Array 转成独立的 ArrayBuffer（规避 TS 对 ArrayBufferLike 的窄化）。 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ─── Token Store ─────────────────────────────────────────────────────────────

import { openDB, type IDBPDatabase } from 'idb';

export interface FeishuTokenRecord {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string; // ISO
  refreshExpiresAt: string; // ISO
  scope: string;
}

const DB_NAME = 'feishu-auth-db';
const DB_VERSION = 1;
const STORE = 'tokens';
const KEY = 'current';

let dbInstance: IDBPDatabase | null = null;

async function initAuthDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    },
  });
  return dbInstance;
}

export async function saveFeishuToken(token: FeishuTokenRecord): Promise<void> {
  const blob = await encryptJSON(token);
  const db = await initAuthDB();
  await db.put(STORE, blob, KEY);
}

export async function loadFeishuToken(): Promise<FeishuTokenRecord | null> {
  const db = await initAuthDB();
  const blob = (await db.get(STORE, KEY)) as EncryptedBlob | undefined;
  if (!blob) return null;
  try {
    return await decryptJSON<FeishuTokenRecord>(blob);
  } catch {
    // 解密失败（可能浏览器环境变更）→ 让用户重新授权
    return null;
  }
}

export async function clearFeishuToken(): Promise<void> {
  const db = await initAuthDB();
  await db.delete(STORE, KEY);
}
