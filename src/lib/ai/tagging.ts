import { listItems, updateItem, addLink, getTaggingContext } from '@/lib/storage/knowledge-store';

// ═══════════════════════════════════════════════════════════════════════════
// 知识库 AI 打标与关联分析（原寄居于 media/sync-service，媒体订阅移除后迁至此处）
// 服务端已改为非流式 JSON 响应：{ ok: true, result: string }
// ═══════════════════════════════════════════════════════════════════════════

/** 请求 AI JSON 端点，返回原始 AI 文本；失败返回 null */
async function requestAIText(url: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn(`[AI] ${url} request failed:`, res.status);
      return null;
    }
    const data = (await res.json()) as { ok?: boolean; result?: string };
    if (!data.ok || typeof data.result !== 'string') return null;
    return data.result;
  } catch (err) {
    console.warn(`[AI] ${url} request error:`, err);
    return null;
  }
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

    const body = { content: `${title}\n${content}`, title, existingTags, categories };
    const raw = await requestAIText('/api/knowledge/tag', body);

    // Parse AI response and save；JSON 解析失败自动重试一次
    let result = raw ? extractJSON(raw) : null;
    if (!result) {
      console.warn('[AI Tagging] First attempt failed, retrying once...');
      const retryRaw = await requestAIText('/api/knowledge/tag', body);
      result = retryRaw ? extractJSON(retryRaw) : null;
    }

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
      console.warn('[AI Tagging] Failed to extract JSON from AI response. raw preview:', (raw || '').slice(0, 300));
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
    const body = {
      newItem: { title: title || '未命名', summary, tags },
      existingItems: itemsForAI,
    };

    let raw = await requestAIText('/api/knowledge/link', body);
    let linkResult = raw ? (extractJSON(raw) as { links?: Array<{ id: number; reason?: string }> } | null) : null;

    // JSON 解析失败自动重试一次
    if (!linkResult) {
      const retryRaw = await requestAIText('/api/knowledge/link', body);
      linkResult = retryRaw ? (extractJSON(retryRaw) as { links?: Array<{ id: number; reason?: string }> } | null) : null;
    }

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

/** 从 AI 响应文本中提取 JSON（容错：剥 markdown 围栏 + 括号计数） */
function extractJSON(text: string): { title?: string; summary?: string; tags?: string[]; primaryCategory?: string; newTagReasons?: Record<string, string> } | null {
  try {
    if (!text || text.trim().length === 0) return null;

    // 移除 markdown 代码块标记
    const cleaned = text.replace(/```(?:json)?\s*/g, '').trim();

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
