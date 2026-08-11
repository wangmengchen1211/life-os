/**
 * Obsidian 导入器：扫描 vault 下 markdown → upsert 到 knowledge-store → 异步触发打标。
 *
 * externalId 约定：`obsidian:<relativePath>`
 */

import { upsertByExternalId, getTaggingContext } from '@/lib/storage/knowledge-store';
import { parseMarkdown, extractFallbackTitle } from '@/lib/obsidian/markdown-parser';
import { scanMarkdown, type VaultFile } from '@/lib/obsidian/vault-adapter';
import { triggerAITagging } from '@/lib/ai/tagging';
import type { ImportProgress, ImportSummary, ProgressHandler } from './types';

export interface ObsidianImportOptions {
  /** 直接提供文件列表（兜底路径）。二选一：与 handle 二选一 */
  files?: VaultFile[];
  /** File System Access API 的目录 handle（主路径） */
  handle?: FileSystemDirectoryHandle;
  /** 是否导入后异步触发 AI 打标 */
  autoTagging?: boolean;
  onProgress?: ProgressHandler;
}

export async function importObsidianVault(options: ObsidianImportOptions): Promise<ImportSummary> {
  const startedAt = new Date().toISOString();
  const summary: ImportSummary = {
    source: 'obsidian',
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    total: 0,
    errors: [],
    startedAt,
    finishedAt: startedAt,
  };

  // 计算 vault 名称，用于 sourceCollection
  let vaultName: string;
  if (options.handle) {
    vaultName = options.handle.name;
  } else if (options.files && options.files.length > 0) {
    const firstRelPath = options.files[0].relativePath;
    const firstSegment = firstRelPath.split('/')[0];
    vaultName = firstSegment && firstSegment !== firstRelPath ? firstSegment : '未命名 Vault';
  } else {
    vaultName = '未命名 Vault';
  }

  const autoTagging = options.autoTagging ?? true;
  const emit = (p: Partial<ImportProgress>) => {
    options.onProgress?.({
      processed: summary.inserted + summary.updated + summary.skipped + summary.failed,
      total: summary.total,
      ...p,
    });
  };

  // 组装文件源：兜底数组 or 异步迭代器
  const fileSource: AsyncIterable<VaultFile> = options.files
    ? (async function* () {
        for (const f of options.files!) yield f;
      })()
    : options.handle
      ? scanMarkdown(options.handle)
      : (async function* () {})();

  if (options.files) summary.total = options.files.length;
  emit({ stage: '扫描中' });

  const toTag: Array<{ itemId: number; title: string; content: string }> = [];

  for await (const file of fileSource) {
    if (!options.files) summary.total += 1; // 边扫边记总数
    try {
      const raw = await file.readText();
      const parsed = parseMarkdown(raw);
      const title = parsed.title?.trim() || extractFallbackTitle(parsed.body) || file.name.replace(/\.md$/i, '');
      const externalId = `obsidian:${file.relativePath}`;

      const res = await upsertByExternalId(externalId, {
        type: 'obsidian',
        title,
        rawContent: parsed.body,
        sourcePlatform: 'obsidian',
        topicTags: parsed.tags && parsed.tags.length > 0 ? parsed.tags : [],
        externalUpdatedAt: file.lastModified,
        sourceCollection: `Obsidian · ${vaultName}`,
        sourcePosition: file.relativePath,
      });

      if (res.action === 'inserted') summary.inserted += 1;
      else if (res.action === 'updated') summary.updated += 1;
      else summary.skipped += 1;

      // 新写入/更新的 item，排队异步打标（跳过 skipped，且若 frontmatter 已给 tags 则跳过）
      if (
        autoTagging &&
        res.action !== 'skipped' &&
        (!parsed.tags || parsed.tags.length === 0)
      ) {
        toTag.push({ itemId: res.id, title, content: parsed.body });
      }

      emit({ current: file.relativePath, action: res.action, stage: '写入中' });
    } catch (err) {
      summary.failed += 1;
      summary.errors.push({
        file: file.relativePath,
        message: err instanceof Error ? err.message : String(err),
      });
      emit({ current: file.relativePath, action: 'failed', stage: '写入中' });
    }
  }

  summary.finishedAt = new Date().toISOString();
  emit({ stage: '完成' });

  // 打标按 3 个并发异步触发，不阻塞 summary 返回
  if (autoTagging && toTag.length > 0) {
    // 批量导入前一次性获取 tagging context，避免每次打标重复查询
    let taggingContext: { existingTags: string[]; categories: string[] } | undefined;
    try {
      taggingContext = await getTaggingContext();
    } catch {
      // 获取失败时 triggerAITagging 内部会自行重试
    }
    void runTaggingQueue(toTag, 3, taggingContext);
  }

  return summary;
}

async function runTaggingQueue(
  queue: Array<{ itemId: number; title: string; content: string }>,
  concurrency: number,
  taggingContext?: { existingTags: string[]; categories: string[] }
): Promise<void> {
  let idx = 0;
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (idx < queue.length) {
      const current = queue[idx++];
      try {
        await triggerAITagging(current.itemId, current.title, current.content, taggingContext);
      } catch {
        /* 忽略单条失败 */
      }
    }
  });
  await Promise.all(workers);
}
