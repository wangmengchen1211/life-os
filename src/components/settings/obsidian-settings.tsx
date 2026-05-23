'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  isFileSystemAccessSupported,
  connectVault,
  restoreVault,
  disconnectVault,
  filesFromInputList,
  type VaultFile,
} from '@/lib/obsidian/vault-adapter';
import { importObsidianVault } from '@/lib/importer/obsidian-importer';
import type { ImportProgress, ImportSummary } from '@/lib/importer/types';

export default function ObsidianSettings() {
  const [supported, setSupported] = useState(false);
  const [vaultName, setVaultName] = useState<string | null>(null);
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const init = useCallback(async () => {
    setSupported(isFileSystemAccessSupported());
    try {
      const rec = await restoreVault();
      if (rec && rec !== 'denied') {
        setHandle(rec.handle);
        setVaultName(rec.displayName);
        setSavedAt(rec.savedAt);
      }
    } catch {
      /* 权限异常不阻塞 UI 加载 */
    }
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  async function handleConnect() {
    setError(null);
    try {
      const res = await connectVault();
      if (!res) return; // 用户取消
      setHandle(res.handle);
      setVaultName(res.displayName);
      setSavedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : '连接失败');
    }
  }

  async function handleDisconnect() {
    if (!confirm('断开 Obsidian vault？已导入的笔记仍会保留在知识库中。')) return;
    await disconnectVault();
    setHandle(null);
    setVaultName(null);
    setSavedAt(null);
    setResult(null);
  }

  async function handleImport(files?: VaultFile[]) {
    if (!files && !handle) return;
    setImporting(true);
    setProgress(null);
    setResult(null);
    setError(null);
    try {
      const summary = await importObsidianVault({
        files,
        handle: handle ?? undefined,
        autoTagging: true,
        onProgress: (p) => setProgress(p),
      });
      setResult(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
    } finally {
      setImporting(false);
    }
  }

  function handleFallbackPick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    const files = filesFromInputList(list);
    if (files.length === 0) {
      setError('所选目录下未找到 .md 文件');
      return;
    }
    void handleImport(files);
    e.target.value = '';
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-medium text-gray-600">Obsidian vault 导入</h2>
        <span className="text-xs text-gray-400">单向只读</span>
      </div>

      {/* ─── Vault 连接状态 ─────────────────────────────────────────── */}
      {vaultName ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/50 border border-gray-100/60">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-sm text-gray-700 truncate flex-1">{vaultName}</span>
          {savedAt && (
            <span className="text-xs text-gray-400 hidden sm:inline">
              已授权 {new Date(savedAt).toLocaleDateString('zh-CN')}
            </span>
          )}
          <button
            onClick={handleDisconnect}
            className="text-gray-300 hover:text-rose-400 transition-colors text-lg leading-none"
            title="断开"
          >
            ×
          </button>
        </div>
      ) : supported ? (
        <div className="bg-white/40 rounded-xl p-4 border border-gray-100/40 space-y-2">
          <p className="text-xs text-gray-500">
            选择本地 Obsidian vault 根目录。授权仅本地保存，不会上传服务器。
          </p>
          <button
            onClick={handleConnect}
            className="px-3 py-1.5 text-sm rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-600 transition-colors"
          >
            选择 vault 目录
          </button>
        </div>
      ) : (
        <div className="bg-white/40 rounded-xl p-4 border border-gray-100/40 space-y-2">
          <p className="text-xs text-gray-500">
            当前浏览器不支持 File System Access API，请使用下方兜底上传（一次性，不持久化）。
          </p>
        </div>
      )}

      {/* ─── 导入触发 ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {handle && (
          <button
            onClick={() => handleImport()}
            disabled={importing}
            className="px-4 py-2 text-sm rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-medium transition-colors disabled:opacity-50"
          >
            {importing ? '导入中…' : '全量导入 vault'}
          </button>
        )}

        {/* 兜底路径：webkitdirectory 目录选择 */}
        <label className="px-4 py-2 text-sm rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 cursor-pointer transition-colors">
          <span>{supported ? '上传目录（兜底）' : '上传 vault 目录'}</span>
          <input
            type="file"
            // @ts-expect-error — webkitdirectory 非标准属性
            webkitdirectory=""
            directory=""
            multiple
            accept=".md"
            className="hidden"
            onChange={handleFallbackPick}
            disabled={importing}
          />
        </label>
      </div>

      {/* ─── 进度 & 结果 ────────────────────────────────────────────── */}
      {progress && importing && (
        <div className="text-xs text-gray-500">
          {progress.stage ?? '处理中'} · {progress.processed}/{progress.total || '?'}{' '}
          {progress.current && <span className="text-gray-400">· {progress.current}</span>}
        </div>
      )}

      {result && (
        <div className="text-xs text-gray-600 bg-white/50 rounded-lg p-3 border border-gray-100/60 space-y-1">
          <p>
            共 {result.total} 个文件，新增 {result.inserted}，更新 {result.updated}，跳过{' '}
            {result.skipped}
            {result.failed > 0 && <>，失败 <span className="text-rose-500">{result.failed}</span></>}
          </p>
          {result.errors.slice(0, 3).map((e, i) => (
            <p key={i} className="text-rose-500/80 truncate">
              {e.file}：{e.message}
            </p>
          ))}
          {result.errors.length > 3 && (
            <p className="text-gray-400">…还有 {result.errors.length - 3} 条错误</p>
          )}
        </div>
      )}

      {error && <p className="text-xs text-rose-500">{error}</p>}
    </section>
  );
}
