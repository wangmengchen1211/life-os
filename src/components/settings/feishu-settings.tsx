'use client';

import { useEffect, useState, useCallback } from 'react';
import { saveFeishuToken, loadFeishuToken, clearFeishuToken } from '@/lib/feishu/token-crypto';
import { ensureFreshFeishuToken } from '@/lib/feishu/auth-client';
import { importFeishuDocs, importFeishuWikiDocs } from '@/lib/importer/feishu-importer';
import type { ImportProgress, ImportSummary } from '@/lib/importer/types';

interface FeishuAuthPayload {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
  scope: string;
  state?: string;
}

export default function FeishuSettings() {
  const [authorized, setAuthorized] = useState(false);
  const [accessExpiresAt, setAccessExpiresAt] = useState<string | null>(null);

  const [connecting, setConnecting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingWiki, setImportingWiki] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const rec = await loadFeishuToken();
    if (rec) {
      setAuthorized(true);
      setAccessExpiresAt(rec.accessExpiresAt);
    } else {
      setAuthorized(false);
      setAccessExpiresAt(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleAuthorize() {
    setError(null);
    setConnecting(true);

    try {
      const r = await fetch('/api/feishu/oauth/url');
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || '授权链接生成失败，请检查飞书环境变量');
      }
      const { url } = (await r.json()) as { url: string; state: string };

      // 清理上次遗留的 localStorage 回执
      const LS_KEY = '__feishu_oauth_result';
      try {
        localStorage.removeItem(LS_KEY);
      } catch {}

      // 打开弹窗；用 postMessage + localStorage 双通道回传 token
      const popup = window.open(url, 'feishu-oauth', 'width=520,height=680');
      if (!popup) {
        throw new Error('弹窗被浏览器拦截，请允许弹窗后重试');
      }

      const payload = await new Promise<FeishuAuthPayload>((resolve, reject) => {
        let done = false;
        const cleanup = () => {
          clearInterval(timer);
          window.removeEventListener('message', onMessage);
        };
        const finish = (ok: boolean, value: FeishuAuthPayload | string) => {
          if (done) return;
          done = true;
          cleanup();
          if (ok) resolve(value as FeishuAuthPayload);
          else reject(new Error(value as string));
        };

        const handleData = (data: {
          type?: string;
          ok?: boolean;
          payload?: FeishuAuthPayload;
          error?: string;
        }) => {
          if (!data || data.type !== 'feishu-oauth') return;
          if (data.ok && data.payload) finish(true, data.payload);
          else finish(false, data.error || '授权失败');
        };

        const onMessage = (ev: MessageEvent) => handleData(ev.data);
        window.addEventListener('message', onMessage);

        const timer = setInterval(() => {
          // localStorage 兜底（同源场景下 window.opener 丢失时仍可接收）
          try {
            const raw = localStorage.getItem(LS_KEY);
            if (raw) {
              localStorage.removeItem(LS_KEY);
              handleData(JSON.parse(raw));
              return;
            }
          } catch {}
          // 窗口被用户关闭
          if (popup.closed && !done) {
            finish(false, '授权窗口已关闭');
          }
        }, 600);
      });

      await saveFeishuToken({
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        accessExpiresAt: payload.accessExpiresAt,
        refreshExpiresAt: payload.refreshExpiresAt,
        scope: payload.scope,
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '授权失败');
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('撤销飞书授权？已导入的文档仍会保留在知识库中。')) return;
    await clearFeishuToken();
    await refresh();
    setResult(null);
  }

  async function handleImport() {
    setError(null);
    setResult(null);
    setProgress(null);
    setImporting(true);
    try {
      const token = await ensureFreshFeishuToken();
      if (!token) {
        throw new Error('授权已过期，请重新授权');
      }
      const summary = await importFeishuDocs({
        userAccessToken: token.accessToken,
        recursive: true,
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

  async function handleImportWiki() {
    setError(null);
    setResult(null);
    setProgress(null);
    setImportingWiki(true);
    try {
      const token = await ensureFreshFeishuToken();
      if (!token) {
        throw new Error('授权已过期，请重新授权');
      }
      const summary = await importFeishuWikiDocs({
        userAccessToken: token.accessToken,
        autoTagging: true,
        onProgress: (p) => setProgress(p),
      });
      setResult(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
    } finally {
      setImportingWiki(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-medium text-gray-600">飞书云文档导入</h2>
        <span className="text-xs text-gray-400">仅支持 docx 类型 · 单向只读</span>
      </div>

      {/* ─── 授权状态 ─────────────────────────────────────────────── */}
      {authorized ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/50 border border-gray-100/60">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-sm text-gray-700 flex-1">已授权</span>
          {accessExpiresAt && (
            <span className="text-xs text-gray-400 hidden sm:inline">
              有效至 {new Date(accessExpiresAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={handleDisconnect}
            className="text-gray-300 hover:text-rose-400 transition-colors text-lg leading-none"
            title="撤销授权"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="bg-white/40 rounded-xl p-4 border border-gray-100/40 space-y-2">
          <p className="text-xs text-gray-500">
            授权飞书云文档只读权限（drive + docx）。token 加密保存在本地 IndexedDB。
          </p>
          <button
            onClick={handleAuthorize}
            disabled={connecting}
            className="px-3 py-1.5 text-sm rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-600 transition-colors disabled:opacity-50"
          >
            {connecting ? '授权中…' : '授权飞书'}
          </button>
        </div>
      )}

      {/* ─── 导入触发 ───────────────────────────────────────────────── */}
      {authorized && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleImport}
            disabled={importing || importingWiki}
            className="px-4 py-2 text-sm rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-medium transition-colors disabled:opacity-50"
          >
            {importing ? '导入中…' : '全量导入云空间文档'}
          </button>
          <button
            onClick={handleImportWiki}
            disabled={importing || importingWiki}
            className="px-4 py-2 text-sm rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-medium transition-colors disabled:opacity-50"
          >
            {importingWiki ? '导入中…' : '全量导入知识库文档'}
          </button>
          <span className="text-xs text-gray-400">增量：已存在且未更新的文档会自动跳过</span>
        </div>
      )}

      {/* ─── 进度 & 结果 ────────────────────────────────────────────── */}
      {progress && (importing || importingWiki) && (
        <div className="text-xs text-gray-500">
          {progress.stage ?? '处理中'} · {progress.processed}/{progress.total || '?'}{' '}
          {progress.current && <span className="text-gray-400">· {progress.current}</span>}
        </div>
      )}

      {result && (
        <div className="text-xs text-gray-600 bg-white/50 rounded-lg p-3 border border-gray-100/60 space-y-1">
          <p>
            共 {result.total} 篇文档，新增 {result.inserted}，更新 {result.updated}，跳过{' '}
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
