/**
 * 飞书导入器：
 *  1. 用 user_access_token 列出云空间文件（递归 folder）
 *  2. 只保留 docx 类型
 *  3. 拉取 raw_content → upsert 到 knowledge-store
 *  4. 新/更新条目排队异步打标
 *
 * externalId 约定：`feishu:<docToken>`
 *
 * 注：access_token 过期时，由 UI 侧先刷新再调用；importer 本身不做刷新。
 */

import { upsertByExternalId, getTaggingContext } from '@/lib/storage/knowledge-store';
import { triggerAITagging } from '@/lib/media/sync-service';
import type { ImportProgress, ImportSummary, ProgressHandler } from './types';

export interface FeishuImportOptions {
  userAccessToken: string;
  /** 从哪个目录开始（不填=根目录） */
  rootFolderToken?: string;
  /** 是否递归子文件夹 */
  recursive?: boolean;
  autoTagging?: boolean;
  onProgress?: ProgressHandler;
}

interface FeishuFileLite {
  token: string;
  name: string;
  type: string;
  url?: string;
  modified_time?: string;
  parent_token?: string;
  /** 文件所在目录路径（导入时构建） */
  folderPath?: string;
}

export async function importFeishuDocs(options: FeishuImportOptions): Promise<ImportSummary> {
  const startedAt = new Date().toISOString();
  const summary: ImportSummary = {
    source: 'feishu',
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    total: 0,
    errors: [],
    startedAt,
    finishedAt: startedAt,
  };

  const autoTagging = options.autoTagging ?? true;
  const recursive = options.recursive ?? true;
  const emit = (p: Partial<ImportProgress>) => {
    options.onProgress?.({
      processed: summary.inserted + summary.updated + summary.skipped + summary.failed,
      total: summary.total,
      ...p,
    });
  };

  emit({ stage: '扫描中' });

  // 1. 扫描文件（支持分页 + 递归子目录）
  const docs: FeishuFileLite[] = [];
  const folderQueue: Array<{ folderToken: string | undefined; folderPath: string }> = [
    { folderToken: options.rootFolderToken, folderPath: '' },
  ];
  const visited = new Set<string>();

  while (folderQueue.length > 0) {
    const { folderToken, folderPath } = folderQueue.shift()!;
    if (folderToken && visited.has(folderToken)) continue;
    if (folderToken) visited.add(folderToken);

    let pageToken: string | undefined = undefined;
    do {
      const page = await listDrivePage({
        userAccessToken: options.userAccessToken,
        folderToken,
        pageToken,
      });
      for (const f of page.files) {
        if (f.type === 'folder') {
          if (recursive) {
            const childPath = folderPath ? `${folderPath}/${f.name}` : f.name;
            folderQueue.push({ folderToken: f.token, folderPath: childPath });
          }
        } else if (f.type === 'docx') {
          docs.push({ ...f, folderPath });
        }
        // 其他类型（doc/sheet/bitable/...）暂不支持
      }
      pageToken = page.next_page_token && page.has_more ? page.next_page_token : undefined;
    } while (pageToken);
  }

  summary.total = docs.length;
  emit({ stage: '写入中' });

  const toTag: Array<{ itemId: number; title: string; content: string }> = [];

  // 2. 逐份拉取正文并 upsert
  for (const doc of docs) {
    try {
      const content = await fetchDocxContent({
        userAccessToken: options.userAccessToken,
        docToken: doc.token,
      });
      const externalId = `feishu:${doc.token}`;
      const externalUpdatedAt = doc.modified_time
        ? new Date(Number(doc.modified_time) * 1000).toISOString()
        : undefined;

      const res = await upsertByExternalId(externalId, {
        type: 'feishu',
        title: doc.name || '无标题',
        rawContent: content,
        sourceUrl: doc.url,
        sourcePlatform: 'feishu',
        topicTags: [],
        externalUpdatedAt,
        sourceCollection: '飞书 · 云空间',
        sourcePosition: doc.folderPath || undefined,
      });

      if (res.action === 'inserted') summary.inserted += 1;
      else if (res.action === 'updated') summary.updated += 1;
      else summary.skipped += 1;

      if (autoTagging && res.action !== 'skipped') {
        toTag.push({ itemId: res.id, title: doc.name || '无标题', content });
      }

      emit({ current: doc.name, action: res.action });
    } catch (err) {
      summary.failed += 1;
      summary.errors.push({
        file: doc.name,
        message: err instanceof Error ? err.message : String(err),
      });
      emit({ current: doc.name, action: 'failed' });
    }
  }

  summary.finishedAt = new Date().toISOString();
  emit({ stage: '完成' });

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

// ─── 内部 API 调用（走 Next.js 路由代理，避开 CORS + 隐藏 app_secret） ───────────

async function listDrivePage(params: {
  userAccessToken: string;
  folderToken?: string;
  pageToken?: string;
}): Promise<{ files: FeishuFileLite[]; next_page_token?: string; has_more: boolean }> {
  const res = await fetch('/api/feishu/docs/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `列目录失败: HTTP ${res.status}`);
  }
  return (await res.json()) as {
    files: FeishuFileLite[];
    next_page_token?: string;
    has_more: boolean;
  };
}

async function fetchDocxContent(params: {
  userAccessToken: string;
  docToken: string;
}): Promise<string> {
  const res = await fetch('/api/feishu/docs/content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `读取文档失败: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { content?: string };
  return data.content || '';
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
        /* 忽略单条 */
      }
    }
  });
  await Promise.all(workers);
}

// ═══ 知识库 Wiki 导入 ═══════════════════════════════════════════════════════════════

export interface FeishuWikiImportOptions {
  userAccessToken: string;
  /** 指定空间 ID，缺省导全部可访问的知识空间 */
  spaceIds?: string[];
  autoTagging?: boolean;
  onProgress?: ProgressHandler;
}

interface WikiDocNode {
  node_token: string;
  obj_token: string;
  title: string;
  obj_edit_time?: string;
  space_id: string;
  space_name: string;
  /** 节点在知识树中的路径（不含自身标题） */
  nodePath?: string;
}

export async function importFeishuWikiDocs(
  options: FeishuWikiImportOptions
): Promise<ImportSummary> {
  const startedAt = new Date().toISOString();
  const summary: ImportSummary = {
    source: 'feishu',
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    total: 0,
    errors: [],
    startedAt,
    finishedAt: startedAt,
  };

  const autoTagging = options.autoTagging ?? true;
  const emit = (p: Partial<ImportProgress>) => {
    options.onProgress?.({
      processed: summary.inserted + summary.updated + summary.skipped + summary.failed,
      total: summary.total,
      ...p,
    });
  };

  emit({ stage: '扫描知识空间' });

  // 1. 确定要扫的空间
  const spaces: Array<{ space_id: string; name: string }> = [];
  if (options.spaceIds && options.spaceIds.length > 0) {
    for (const id of options.spaceIds) spaces.push({ space_id: id, name: id });
  } else {
    let pageToken: string | undefined = undefined;
    do {
      const page = await listWikiSpacesPage({
        userAccessToken: options.userAccessToken,
        pageToken,
      });
      for (const sp of page.items) spaces.push({ space_id: sp.space_id, name: sp.name });
      pageToken = page.next_page_token && page.has_more ? page.next_page_token : undefined;
    } while (pageToken);
  }

  if (spaces.length === 0) {
    emit({ stage: '完成' });
    summary.finishedAt = new Date().toISOString();
    return summary;
  }

  // 2. 逐空间递归收集 docx 节点
  const docs: WikiDocNode[] = [];

  for (const space of spaces) {
    emit({ stage: `扫描「${space.name}」` });
    const nodeQueue: Array<{ nodeToken: string | undefined; nodePath: string }> = [
      { nodeToken: undefined, nodePath: '' },
    ]; // undefined = 根层
    const visited = new Set<string>();

    while (nodeQueue.length > 0) {
      const { nodeToken: parentToken, nodePath: parentPath } = nodeQueue.shift()!;
      if (parentToken && visited.has(parentToken)) continue;
      if (parentToken) visited.add(parentToken);

      let pageToken: string | undefined = undefined;
      do {
        const page = await listWikiNodesPage({
          userAccessToken: options.userAccessToken,
          spaceId: space.space_id,
          parentNodeToken: parentToken,
          pageToken,
        });
        for (const n of page.items) {
          const childPath = parentPath
            ? `${parentPath}/${n.title || '未命名'}`
            : (n.title || '未命名');
          if (n.has_child) {
            nodeQueue.push({ nodeToken: n.node_token, nodePath: childPath });
          }
          if (n.obj_type === 'docx' && n.obj_token) {
            docs.push({
              node_token: n.node_token,
              obj_token: n.obj_token,
              title: n.title || '无标题',
              obj_edit_time: n.obj_edit_time,
              space_id: space.space_id,
              space_name: space.name,
              nodePath: parentPath || undefined,
            });
          }
          // 其他 obj_type（doc/sheet/bitable/slides/mindnote）暂不支持
        }
        pageToken = page.next_page_token && page.has_more ? page.next_page_token : undefined;
      } while (pageToken);
    }
  }

  summary.total = docs.length;
  emit({ stage: '写入中' });

  const toTag: Array<{ itemId: number; title: string; content: string }> = [];

  // 3. 逐篇拉正文并 upsert
  for (const doc of docs) {
    try {
      const content = await fetchDocxContent({
        userAccessToken: options.userAccessToken,
        docToken: doc.obj_token,
      });
      const externalId = `feishu:${doc.obj_token}`;
      const externalUpdatedAt = doc.obj_edit_time
        ? new Date(Number(doc.obj_edit_time) * 1000).toISOString()
        : undefined;

      const res = await upsertByExternalId(externalId, {
        type: 'feishu',
        title: doc.title,
        rawContent: content,
        sourcePlatform: 'feishu',
        topicTags: [],
        externalUpdatedAt,
        sourceCollection: `飞书 · ${doc.space_name}`,
        sourcePosition: doc.nodePath || undefined,
      });

      if (res.action === 'inserted') summary.inserted += 1;
      else if (res.action === 'updated') summary.updated += 1;
      else summary.skipped += 1;

      if (autoTagging && res.action !== 'skipped') {
        toTag.push({ itemId: res.id, title: doc.title, content });
      }

      emit({ current: `${doc.space_name} / ${doc.title}`, action: res.action });
    } catch (err) {
      summary.failed += 1;
      summary.errors.push({
        file: `${doc.space_name} / ${doc.title}`,
        message: err instanceof Error ? err.message : String(err),
      });
      emit({ current: doc.title, action: 'failed' });
    }
  }

  summary.finishedAt = new Date().toISOString();
  emit({ stage: '完成' });

  if (autoTagging && toTag.length > 0) {
    // 批量导入前一次性获取 tagging context
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

async function listWikiSpacesPage(params: {
  userAccessToken: string;
  pageToken?: string;
}): Promise<{
  items: Array<{ space_id: string; name: string }>;
  next_page_token?: string;
  has_more: boolean;
}> {
  const res = await fetch('/api/feishu/wiki/spaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `列知识空间失败: HTTP ${res.status}`);
  }
  return (await res.json()) as {
    items: Array<{ space_id: string; name: string }>;
    next_page_token?: string;
    has_more: boolean;
  };
}

async function listWikiNodesPage(params: {
  userAccessToken: string;
  spaceId: string;
  parentNodeToken?: string;
  pageToken?: string;
}): Promise<{
  items: Array<{
    node_token: string;
    obj_token: string;
    obj_type: string;
    title: string;
    has_child?: boolean;
    obj_edit_time?: string;
  }>;
  next_page_token?: string;
  has_more: boolean;
}> {
  const res = await fetch('/api/feishu/wiki/nodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `列知识节点失败: HTTP ${res.status}`);
  }
  return (await res.json()) as {
    items: Array<{
      node_token: string;
      obj_token: string;
      obj_type: string;
      title: string;
      has_child?: boolean;
      obj_edit_time?: string;
    }>;
    next_page_token?: string;
    has_more: boolean;
  };
}
