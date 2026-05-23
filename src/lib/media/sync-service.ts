import { listConfigs, updateConfig, addSyncLog } from '@/lib/storage/media-store';
import type { MediaConfig } from '@/lib/storage/media-store';
import { addItem, listItems, updateItem, addLink, getTaggingContext } from '@/lib/storage/knowledge-store';
import { getPlatformLabel } from '@/lib/media/url-patterns';
import { safeText } from '@/lib/utils/safe-text';

export interface SyncResult {
  configId: number;
  platform: string;
  newItems: number;
  status: 'success' | 'fail';
  error?: string;
}

/** 确保值为纯字符串（防御性处理 XML 解析对象残留） */
const ensureString = safeText;

// 同步所有 RSS 源
export async function syncAllFeeds(): Promise<SyncResult[]> {
  const configs = await listConfigs();
  const results: SyncResult[] = [];

  for (const config of configs) {
    const result = await syncFeed(config);
    results.push(result);
  }

  return results;
}

// 同步单个 RSS 源
export async function syncFeed(config: MediaConfig): Promise<SyncResult> {
  const configId = config.id!;

  try {
    // 1. 调用 /api/media/rss/parse 获取文章列表
    const response = await fetch('/api/media/rss/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rssUrl: config.rssUrl }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || '解析失败');
    }

    const { items } = await response.json();

    // 2. 获取已有的 creation_article 去重
    const existingItems = await listItems({ type: 'creation_article' });
    const existingUrls = new Set(
      existingItems
        .map(item => safeText(item.sourceUrl))
        .filter(url => url.length > 0)
    );
    // 同时按标题去重，防止无 link 的文章重复导入
    const existingTitles = new Set(
      existingItems.map(item => safeText(item.title))
    );

    // 3. 筛选新文章（按 sourceUrl 去重；无 link 时按标题去重）
    const newArticles = (items as Array<{ title?: string; link?: string; description?: string; pubDate?: string }>)
      .filter(item => {
        const link = ensureString(item.link);
        const title = ensureString(item.title);
        if (link) {
          return !existingUrls.has(link);
        }
        // 无 link 时用标题去重
        return title && !existingTitles.has(title);
      });

    // 4. 新文章入库 knowledge-store
    for (const article of newArticles) {
      const title = ensureString(article.title) || '无标题';
      const description = ensureString(article.description);
      const link = ensureString(article.link) || undefined;
      const pubDate = ensureString(article.pubDate) || undefined;

      const itemId = await addItem({
        type: 'creation_article',
        title,
        sourceUrl: link,
        rawContent: description,
        sourcePlatform: config.platform,
        publishDate: pubDate,
        topicTags: [],
      });

      // 5. 触发 AI 打标+摘要（静默后台，不等待）
      triggerAITagging(itemId, title, description);
    }

    // 6. 更新配置同步状态
    await updateConfig(configId, {
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: 'success',
    });

    // 7. 记录同步日志
    await addSyncLog({
      configId,
      status: 'success',
      itemsCount: newArticles.length,
    });

    return {
      configId,
      platform: getPlatformLabel(config.platform),
      newItems: newArticles.length,
      status: 'success',
    };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '未知错误';

    // 同步失败处理
    await updateConfig(configId, {
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: 'fail',
    });

    await addSyncLog({
      configId,
      status: 'fail',
      itemsCount: 0,
      errorMsg: errMsg,
    });

    return {
      configId,
      platform: getPlatformLabel(config.platform),
      newItems: 0,
      status: 'fail',
      error: errMsg,
    };
  }
}

// 检查是否需要自动同步（距上次同步超过 24 小时）
export async function shouldAutoSync(): Promise<boolean> {
  const configs = await listConfigs();
  if (configs.length === 0) return false;

  // 找最近一次同步时间
  const lastSyncTimes = configs
    .map(c => c.lastSyncAt)
    .filter((t): t is string => !!t);

  if (lastSyncTimes.length === 0) return true; // 从未同步过

  const latestSync = new Date(
    Math.max(...lastSyncTimes.map(t => new Date(t).getTime()))
  );
  const hoursSinceLastSync =
    (Date.now() - latestSync.getTime()) / (1000 * 60 * 60);

  return hoursSinceLastSync >= 24;
}

// 触发 AI 打标+摘要
export async function triggerAITagging(
  itemId: number,
  title: string,
  content: string,
  taggingContext?: { existingTags: string[]; categories: string[] }
): Promise<boolean> {
  try {
    // 如果调用方未提供 context，尝试自行获取
    let existingTags: string[] = taggingContext?.existingTags || [];
    let categories: string[] = taggingContext?.categories || [];
    if (!taggingContext) {
      try {
        const ctx = await getTaggingContext();
        existingTags = ctx.existingTags;
        categories = ctx.categories;
      } catch {
        // 获取失败时使用空数组
      }
    }

    const res = await fetch('/api/knowledge/tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `${title}\n${content}`, title, existingTags, categories }),
    });

    if (!res.ok || !res.body) {
      console.warn('[AI Tagging] API request failed:', res.status);
      return false;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const event of events) {
        const line = event.trim();
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'text') fullText += data.content;
          else if (data.type === 'done') {
            // done 事件的 content 通常包含完整 JSON，但如果为空则保留累积的 fullText
            if (data.content && data.content.trim().length > 0) {
              fullText = data.content;
            }
          }
        } catch { /* ignore parse errors */ }
      }
    }

    // Handle remaining buffer
    if (buffer.trim().startsWith('data: ')) {
      try {
        const data = JSON.parse(buffer.trim().slice(6));
        if (data.type === 'text') fullText += data.content;
        else if (data.type === 'done') {
          if (data.content && data.content.trim().length > 0) {
            fullText = data.content;
          }
        }
      } catch { /* ignore */ }
    }

    // Parse AI response and save
    const result = extractJSON(fullText);
    if (result) {
      await updateItem(itemId, {
        aiSummary: result.summary || '',
        topicTags: result.tags || [],
        primaryCategory: result.primaryCategory || undefined,
      });

      // Trigger link analysis after successful tagging
      triggerLinkAnalysis(itemId, title, result.summary, result.tags);
      return true;
    } else {
      console.warn('[AI Tagging] Failed to extract JSON from AI response. fullText length:', fullText.length, 'preview:', fullText.slice(0, 300));
      return false;
    }
  } catch (err) {
    console.error('[AI Tagging] Error:', err);
    return false;
  }
}

// ─── Background AI Link Analysis ─────────────────────────────────────────────

async function triggerLinkAnalysis(
  itemId: number,
  title?: string,
  summary?: string,
  tags?: string[]
) {
  try {
    // Get all existing items (exclude self)
    const allItems = await listItems();
    const existingItems = allItems
      .filter(item => item.id !== itemId)
      .map(item => ({ id: item.id!, title: item.title, tags: item.topicTags }));

    if (existingItems.length === 0) return;

    // Limit to 30 items for AI (avoid token explosion)
    const itemsForAI = existingItems.slice(0, 30);

    const res = await fetch('/api/knowledge/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newItem: { title: title || '未命名', summary, tags },
        existingItems: itemsForAI,
      }),
    });

    if (!res.ok || !res.body) return;

    // SSE stream parsing
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const event of events) {
        const line = event.trim();
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'text') fullText += data.content;
          else if (data.type === 'done') {
            if (data.content && data.content.trim().length > 0) {
              fullText = data.content;
            }
          }
        } catch { /* ignore parse errors */ }
      }
    }

    // Handle remaining buffer
    if (buffer.trim().startsWith('data: ')) {
      try {
        const data = JSON.parse(buffer.trim().slice(6));
        if (data.type === 'text') fullText += data.content;
        else if (data.type === 'done') {
          if (data.content && data.content.trim().length > 0) {
            fullText = data.content;
          }
        }
      } catch { /* ignore */ }
    }

    const linkResult = extractJSON(fullText) as { links?: Array<{ id: number; reason?: string }> } | null;
    if (linkResult && Array.isArray(linkResult.links)) {
      for (const link of linkResult.links) {
        if (link.id && typeof link.id === 'number') {
          await addLink({
            itemAId: itemId,
            itemBId: link.id,
            relationType: 'supplement',
            aiReason: link.reason || '内容相关',
          });
        }
      }
    }
  } catch (err) {
    console.warn('[Link Analysis] Error:', err);
  }
}

/** 从 AI 响应文本中提取 JSON */
function extractJSON(text: string): { title?: string; summary?: string; tags?: string[]; primaryCategory?: string; newTagReasons?: Record<string, string> } | null {
  try {
    if (!text || text.trim().length === 0) return null;

    // 移除 markdown 代码块标记
    let cleaned = text.replace(/```(?:json)?\s*/g, '').trim();

    // 找到第一个 {
    const start = cleaned.indexOf('{');
    if (start === -1) return null;

    // 从 start 开始，用括号计数找到匹配的 }
    let braceCount = 0;
    let end = -1;
    for (let i = start; i < cleaned.length; i++) {
      if (cleaned[i] === '{') braceCount++;
      else if (cleaned[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          end = i;
          break;
        }
      }
    }

    if (end === -1) return null;

    const jsonStr = cleaned.slice(start, end + 1);
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('[AI Tagging] JSON parse failed:', error instanceof Error ? error.message : String(error), 'Text preview:', text.slice(0, 300));
    return null;
  }
}
