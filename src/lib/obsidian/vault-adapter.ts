/**
 * File System Access API 封装：连接 Obsidian vault、恢复授权、递归扫描 markdown。
 *
 * 仅在 Chromium 桌面端可用。调用方需检查 `isFileSystemAccessSupported()`。
 */

import { saveVaultHandle, loadVaultHandle, clearVaultHandle } from './handle-store';

export interface VaultFile {
  /** vault 根目录为基准的相对路径，使用 POSIX 分隔符 */
  relativePath: string;
  /** 文件名（含扩展名） */
  name: string;
  /** ISO 时间 */
  lastModified: string;
  size: number;
  /** lazy getter；文本内容（UTF-8） */
  readText: () => Promise<string>;
}

const EXCLUDE_DIRS = new Set(['.obsidian', '.git', 'node_modules', '.trash', '.obsidian.trash']);

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
}

/**
 * 弹出目录选择器，授权成功后持久化 handle。
 * 若用户取消则返回 null（不抛异常）。
 */
export async function connectVault(): Promise<{ handle: FileSystemDirectoryHandle; displayName: string } | null> {
  if (!isFileSystemAccessSupported()) {
    throw new Error('当前浏览器不支持 File System Access API，请改用兜底的目录上传模式。');
  }
  try {
    // @ts-expect-error — showDirectoryPicker 类型在部分 DOM lib 版本中未声明
    const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({ mode: 'read' });
    await saveVaultHandle(handle, handle.name);
    return { handle, displayName: handle.name };
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') return null;
    throw err;
  }
}

/**
 * 恢复已保存的 handle；若权限过期会先尝试 query/request permission。
 * 返回 null 表示本地无记录；'denied' 表示用户拒绝授权。
 */
export async function restoreVault(): Promise<
  | { handle: FileSystemDirectoryHandle; displayName: string; savedAt: string }
  | null
  | 'denied'
> {
  const rec = await loadVaultHandle();
  if (!rec) return null;

  const handle = rec.handle as FileSystemDirectoryHandle & {
    queryPermission?: (opts: { mode: 'read' }) => Promise<'granted' | 'denied' | 'prompt'>;
    requestPermission?: (opts: { mode: 'read' }) => Promise<'granted' | 'denied' | 'prompt'>;
  };

  if (handle.queryPermission) {
    const status = await handle.queryPermission({ mode: 'read' });
    if (status === 'granted') return rec;
    if (handle.requestPermission) {
      const asked = await handle.requestPermission({ mode: 'read' });
      if (asked === 'granted') return rec;
      return 'denied';
    }
  }
  return rec;
}

export async function disconnectVault(): Promise<void> {
  await clearVaultHandle();
}

/**
 * 异步迭代 vault 下所有 markdown 文件。
 */
export async function* scanMarkdown(handle: FileSystemDirectoryHandle): AsyncGenerator<VaultFile> {
  yield* walk(handle, '');
}

async function* walk(dir: FileSystemDirectoryHandle, prefix: string): AsyncGenerator<VaultFile> {
  // entries 是 async iterator（对 DOM lib 的 any 兼容）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for await (const entry of (dir as any).values() as AsyncIterable<FileSystemHandle>) {
    if (entry.kind === 'directory') {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      const sub = entry as FileSystemDirectoryHandle;
      const subPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
      yield* walk(sub, subPrefix);
    } else if (entry.kind === 'file') {
      if (!entry.name.toLowerCase().endsWith('.md')) continue;
      const fileHandle = entry as FileSystemFileHandle;
      const file = await fileHandle.getFile();
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      yield {
        relativePath,
        name: entry.name,
        lastModified: new Date(file.lastModified).toISOString(),
        size: file.size,
        readText: () => file.text(),
      };
    }
  }
}

/**
 * 兜底路径：非 Chromium 浏览器使用 `<input webkitdirectory>` 选出的 File[]
 * 转换成统一的 VaultFile 结构。
 */
export function filesFromInputList(files: FileList | File[]): VaultFile[] {
  const arr = Array.from(files);
  return arr
    .filter((f) => f.name.toLowerCase().endsWith('.md'))
    .map((f) => {
      // webkitRelativePath 形如 "MyVault/daily/2024-01-01.md"，去掉根目录名
      const rel = ((f as File & { webkitRelativePath?: string }).webkitRelativePath ?? f.name).split('/').slice(1).join('/') || f.name;
      // 过滤黑名单目录
      const segments = rel.split('/');
      if (segments.some((s) => EXCLUDE_DIRS.has(s))) {
        return null;
      }
      return {
        relativePath: rel,
        name: f.name,
        lastModified: new Date(f.lastModified).toISOString(),
        size: f.size,
        readText: () => f.text(),
      } satisfies VaultFile;
    })
    .filter((v): v is VaultFile => v !== null);
}
