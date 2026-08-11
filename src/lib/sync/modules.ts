import { createClient } from '@/lib/supabase/client';
import {
  getUserId,
  deleteRow,
  mergeModule,
  pushOne,
  markMigrated,
  SYNC_COMPLETE_EVENT,
  type MergeAdapter,
  type MergeContext,
  type CloudRow,
  LOCAL_UPSERT_EVENT,
  LOCAL_DELETE_EVENT,
  FULL_SYNC_EVENT,
} from './cloud';
import {
  initDB as initDiaryDB,
  type DiaryEntry,
  type DiarySummary,
} from '@/lib/storage/diary-store';
import { initDB as initTodoDB, type Todo } from '@/lib/storage/todo-store';
import {
  initDB as initKnowledgeDB,
  type KnowledgeItem,
  type KnowledgeLink,
  type TopicCategory,
} from '@/lib/storage/knowledge-store';
import { initDB as initMindlogDB, type MindLogEntry } from '@/lib/storage/mindlog-store';
import { initDB as initLetterDB, type Letter } from '@/lib/storage/letter-store';
import {
  initDB as initMirrorDB,
  type MirrorSession,
  type MirrorMessage,
} from '@/lib/storage/mirror-store';
import {
  initDB as initProfileDB,
  getUserProfile,
  type UserProfile,
} from '@/lib/storage/profile-store';

// ═══════════════════════════════════════════════════════════════════════════
// 各数据表 ↔ Supabase 适配器
// 本地记录通过 cloudId 字段映射云端 UUID，字段名 snake_case ↔ camelCase 在此转换
// ═══════════════════════════════════════════════════════════════════════════

import type { IDBPDatabase } from 'idb';

/** 适配器工厂：统一实现 listLocal / putLocal / deleteLocal */
function makeAdapter<T extends { id?: number }>(
  getDb: () => Promise<IDBPDatabase>,
  store: string,
  config: Omit<MergeAdapter<T>, 'listLocal' | 'putLocal' | 'deleteLocal'>,
): MergeAdapter<T> {
  return {
    ...config,
    async listLocal() {
      const db = await getDb();
      return db.getAll(store) as unknown as T[];
    },
    async putLocal(record) {
      const db = await getDb();
      if (record.id !== undefined) {
        await db.put(store, record);
        return record.id;
      }
      return (await db.add(store, record)) as number;
    },
    async deleteLocal(id) {
      const db = await getDb();
      await db.delete(store, id);
    },
  };
}

const cloudIdOf = <T extends { cloudId?: string }>(l: T) => l.cloudId;
const withCloudId = <T extends { cloudId?: string }>(l: T, uuid: string): T => ({
  ...l,
  cloudId: uuid,
});

// ─── 1. 日记回音 ────────────────────────────────────────────────────────────

const diaryEntriesAdapter = makeAdapter<DiaryEntry>(initDiaryDB, 'entries', {
  table: 'diary_entries',
  module: 'diary',
  toPayload(local, ctx) {
    return {
      user_id: ctx.userId,
      content: local.content,
      mood_tags: local.moodTags ?? [],
      key_themes: local.keyThemes ?? [],
      ai_feedback: local.aiFeedback ?? null,
      images: local.images ?? [],
      word_count: local.wordCount ?? local.content.length,
      created_at: local.createdAt,
      updated_at: local.updatedAt,
    };
  },
  toLocal(row) {
    return {
      content: row.content as string,
      moodTags: (row.mood_tags ?? []) as string[],
      keyThemes: (row.key_themes ?? []) as string[],
      aiFeedback: row.ai_feedback as string | undefined,
      images: row.images as string[] | undefined,
      wordCount: row.word_count as number,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  },
  localTimestamp: (l) => l.updatedAt,
  rowTimestamp: (r) => ((r.updated_at ?? r.created_at) as string),
  cloudIdOf,
  withCloudId,
});

const diarySummariesAdapter = makeAdapter<DiarySummary>(initDiaryDB, 'summaries', {
  table: 'diary_summaries',
  module: 'diary',
  toPayload(local, ctx) {
    return {
      user_id: ctx.userId,
      period_type: local.periodType,
      period_start: local.periodStart,
      period_end: local.periodEnd,
      summary_content: local.summaryContent,
      emotion_trend: local.emotionTrend ?? null,
      keyword_cloud: local.keywordCloud ?? null,
      created_at: local.createdAt,
    };
  },
  toLocal(row) {
    return {
      periodType: row.period_type as 'week' | 'month',
      periodStart: row.period_start as string,
      periodEnd: row.period_end as string,
      summaryContent: row.summary_content as string,
      emotionTrend: row.emotion_trend as any,
      keywordCloud: row.keyword_cloud as any,
      createdAt: row.created_at as string,
    };
  },
  localTimestamp: (l) => l.createdAt,
  rowTimestamp: (r) => r.created_at as string,
  cloudIdOf,
  withCloudId,
});

// ─── 2. 思维藤蔓（知识库）──────────────────────────────────────────────────

const knowledgeItemsAdapter = makeAdapter<KnowledgeItem>(initKnowledgeDB, 'items', {
  table: 'knowledge_items',
  module: 'knowledge',
  toPayload(local, ctx) {
    return {
      user_id: ctx.userId,
      type: local.type,
      title: local.title,
      source_url: local.sourceUrl ?? null,
      raw_content: local.rawContent ?? null,
      ai_summary: local.aiSummary ?? null,
      topic_tags: local.topicTags ?? [],
      source_platform: local.sourcePlatform ?? null,
      publish_date: local.publishDate ?? null,
      external_id: local.externalId ?? null,
      external_updated_at: local.externalUpdatedAt ?? null,
      source_collection: local.sourceCollection ?? null,
      source_position: local.sourcePosition ?? null,
      primary_category: local.primaryCategory ?? null,
      created_at: local.createdAt,
      updated_at: local.updatedAt,
    };
  },
  toLocal(row) {
    return {
      type: row.type as KnowledgeItem['type'],
      title: row.title as string,
      sourceUrl: row.source_url as string | undefined,
      rawContent: row.raw_content as string | undefined,
      aiSummary: row.ai_summary as string | undefined,
      topicTags: (row.topic_tags ?? []) as string[],
      sourcePlatform: row.source_platform as string | undefined,
      publishDate: row.publish_date as string | undefined,
      externalId: row.external_id as string | undefined,
      externalUpdatedAt: row.external_updated_at as string | undefined,
      sourceCollection: row.source_collection as string | undefined,
      sourcePosition: row.source_position as string | undefined,
      primaryCategory: row.primary_category as string | undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  },
  localTimestamp: (l) => l.updatedAt,
  rowTimestamp: (r) => ((r.updated_at ?? r.created_at) as string),
  cloudIdOf,
  withCloudId,
});

const knowledgeLinksAdapter = makeAdapter<KnowledgeLink>(initKnowledgeDB, 'links', {
  table: 'knowledge_links',
  module: 'knowledge',
  toPayload(local, ctx) {
    const itemAUuid = ctx.idMap.get(local.itemAId);
    const itemBUuid = ctx.idMap.get(local.itemBId);
    if (!itemAUuid || !itemBUuid) {
      throw new Error(`link 引用条目未同步: ${local.itemAId} → ${local.itemBId}`);
    }
    return {
      user_id: ctx.userId,
      item_a_id: itemAUuid,
      item_b_id: itemBUuid,
      relation_type: local.relationType,
      ai_reason: local.aiReason ?? null,
      created_at: local.createdAt,
    };
  },
  toLocal(row, ctx) {
    const itemA = ctx.reverseIdMap.get(row.item_a_id as string);
    const itemB = ctx.reverseIdMap.get(row.item_b_id as string);
    return {
      itemAId: itemA ?? -1,
      itemBId: itemB ?? -1,
      relationType: row.relation_type as string,
      aiReason: row.ai_reason as string | undefined,
      createdAt: row.created_at as string,
    };
  },
  localTimestamp: (l) => l.createdAt,
  rowTimestamp: (r) => r.created_at as string,
  cloudIdOf,
  withCloudId,
});

const topicCategoriesAdapter = makeAdapter<TopicCategory>(
  initKnowledgeDB,
  'topic-categories',
  {
    table: 'topic_categories',
    module: 'knowledge',
    toPayload(local, ctx) {
      return {
        user_id: ctx.userId,
        name: local.name,
        sub_topics: local.subTopics ?? [],
        is_builtin: local.isBuiltin,
        created_at: local.createdAt,
      };
    },
    toLocal(row) {
      return {
        name: row.name as string,
        subTopics: (row.sub_topics ?? []) as string[],
        isBuiltin: row.is_builtin as boolean,
        createdAt: row.created_at as string,
      };
    },
    localTimestamp: (l) => l.createdAt,
    rowTimestamp: (r) => r.created_at as string,
    cloudIdOf,
    withCloudId,
  },
);

// ─── 3. Todo 轻约 ───────────────────────────────────────────────────────────

const todosAdapter = makeAdapter<Todo>(initTodoDB, 'todos', {
  table: 'todos',
  module: 'todo',
  toPayload(local, ctx) {
    return {
      user_id: ctx.userId,
      title: local.title,
      date: local.date,
      is_completed: local.isCompleted,
      completed_at: local.completedAt ?? null,
      created_at: local.createdAt,
    };
  },
  toLocal(row) {
    return {
      title: row.title as string,
      date: row.date as string,
      isCompleted: row.is_completed as boolean,
      completedAt: row.completed_at as string | undefined,
      createdAt: row.created_at as string,
    };
  },
  localTimestamp: (l) => l.createdAt,
  rowTimestamp: (r) => r.created_at as string,
  cloudIdOf,
  withCloudId,
});

// ─── 4. 心智日志 MindLog ────────────────────────────────────────────────────

const mindlogAdapter = makeAdapter<MindLogEntry>(initMindlogDB, 'entries', {
  table: 'mindlog_reports',
  module: 'mindlog',
  toPayload(local, ctx) {
    return {
      user_id: ctx.userId,
      type: local.type,
      period_start: local.periodStart,
      period_end: local.periodEnd,
      keywords: local.keywords ?? null,
      content: local.content,
      dashboard_summary: local.dashboardSummary ?? null,
      source_data: local.sourceData ?? {},
      created_at: local.createdAt,
    };
  },
  toLocal(row) {
    return {
      type: row.type as MindLogEntry['type'],
      periodStart: row.period_start as string,
      periodEnd: row.period_end as string,
      keywords: row.keywords as string,
      content: row.content as string,
      dashboardSummary: row.dashboard_summary as string,
      sourceData: row.source_data as MindLogEntry['sourceData'],
      createdAt: row.created_at as string,
    };
  },
  localTimestamp: (l) => l.createdAt,
  rowTimestamp: (r) => r.created_at as string,
  cloudIdOf,
  withCloudId,
});

// ─── 5. 人生信笺 ────────────────────────────────────────────────────────────

const lettersAdapter = makeAdapter<Letter>(initLetterDB, 'letters', {
  table: 'letters',
  module: 'letters',
  toPayload(local, ctx) {
    return {
      user_id: ctx.userId,
      period_month: local.periodMonth,
      title: local.title,
      content: local.content,
      monthly_stats: local.monthlyStats ?? {},
      created_at: local.createdAt,
    };
  },
  toLocal(row) {
    return {
      periodMonth: row.period_month as string,
      title: row.title as string,
      content: row.content as string,
      monthlyStats: row.monthly_stats as Letter['monthlyStats'],
      createdAt: row.created_at as string,
    };
  },
  localTimestamp: (l) => l.createdAt,
  rowTimestamp: (r) => r.created_at as string,
  cloudIdOf,
  withCloudId,
});

// ─── 6. 镜像洞见 ────────────────────────────────────────────────────────────

const mirrorSessionsAdapter = makeAdapter<MirrorSession>(initMirrorDB, 'sessions', {
  table: 'mirror_sessions',
  module: 'mirror',
  toPayload(local, ctx) {
    return {
      user_id: ctx.userId,
      title: local.title,
      created_at: local.createdAt,
      updated_at: local.updatedAt,
    };
  },
  toLocal(row) {
    return {
      title: row.title as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  },
  localTimestamp: (l) => l.updatedAt,
  rowTimestamp: (r) => ((r.updated_at ?? r.created_at) as string),
  cloudIdOf,
  withCloudId,
});

const mirrorMessagesAdapter = makeAdapter<MirrorMessage>(initMirrorDB, 'messages', {
  table: 'mirror_messages',
  module: 'mirror',
  toPayload(local, ctx) {
    const sessionUuid = local.sessionId !== undefined
      ? ctx.idMap.get(local.sessionId)
      : undefined;
    return {
      user_id: ctx.userId,
      session_id: sessionUuid ?? null,
      role: local.role,
      content: local.content,
      attachments: local.attachments ?? [],
      created_at: local.createdAt,
    };
  },
  toLocal(row, ctx) {
    const sessionUuid = row.session_id as string | null;
    return {
      sessionId: sessionUuid
        ? ctx.reverseIdMap.get(sessionUuid)
        : undefined,
      role: row.role as 'user' | 'assistant',
      content: row.content as string,
      attachments: row.attachments as MirrorMessage['attachments'],
      createdAt: row.created_at as string,
    };
  },
  localTimestamp: (l) => l.createdAt,
  rowTimestamp: (r) => r.created_at as string,
  cloudIdOf,
  withCloudId,
});

// ─── 注册表 ─────────────────────────────────────────────────────────────────

/** 全部分表按依赖顺序排列（主表在前，子表在后） */
export const ADAPTER_ORDER: MergeAdapter<any>[] = [
  diaryEntriesAdapter,
  diarySummariesAdapter,
  knowledgeItemsAdapter,
  topicCategoriesAdapter,
  knowledgeLinksAdapter,
  todosAdapter,
  mindlogAdapter,
  lettersAdapter,
  mirrorSessionsAdapter,
  mirrorMessagesAdapter,
];

const ADAPTER_BY_TABLE = new Map(
  ADAPTER_ORDER.map((a) => [a.table, a]),
);

/** 子表：变更时走全量合并（需要父表 id 映射），主表走单条推送 */
const CHILD_TABLES = new Set(['knowledge_links', 'mirror_messages']);

/** 构建本地 id → 云端 uuid 映射（供子表引用父表时使用） */
async function buildIdMap(userId: string): Promise<MergeContext> {
  const ctx: MergeContext = {
    userId,
    idMap: new Map(),
    reverseIdMap: new Map(),
  };
  for (const adapter of ADAPTER_ORDER) {
    try {
      const rows = await adapter.listLocal();
      for (const r of rows) {
        const uuid = adapter.cloudIdOf(r);
        if (uuid && r.id !== undefined) {
          ctx.idMap.set(r.id, uuid);
          ctx.reverseIdMap.set(uuid, r.id);
        }
      }
    } catch {
      // 单个模块读取失败不影响整体
    }
  }
  return ctx;
}

/** 处理本地变更事件（store → 云端推送） */
async function handleChange(
  table: string,
  localId?: number,
  cloudId?: string,
): Promise<void> {
  const adapter = ADAPTER_BY_TABLE.get(table);
  if (!adapter) return;

  const userId = await getUserId();
  if (!userId) return;

  try {
    if (cloudId) {
      // 删除：按记录的 cloudId 删除云端行
      await deleteRow(table, cloudId);
      return;
    }

    if (CHILD_TABLES.has(table)) {
      // 子表：全量合并（含父表 id 映射）
      await mergeModule(adapter, await buildIdMap(userId));
      return;
    }

    // 主表：单条推送
    const rows = await adapter.listLocal();
    const local = rows.find((r) => r.id === localId);
    if (!local) return;
    await pushOne(adapter, local, await buildIdMap(userId));
  } catch (e) {
    console.warn(`[sync] ${table} 同步失败:`, e);
  }
}

let listenerInstalled = false;

/** 安装本地变更监听（幂等，客户端专用） */
export function ensureSyncListener(): void {
  if (listenerInstalled || typeof window === 'undefined') return;
  listenerInstalled = true;

  window.addEventListener(LOCAL_UPSERT_EVENT, (e) => {
    const { table, localId } = (e as CustomEvent).detail;
    void handleChange(table, localId);
  });
  window.addEventListener(LOCAL_DELETE_EVENT, (e) => {
    const { table, cloudId } = (e as CustomEvent).detail;
    void handleChange(table, undefined, cloudId);
  });
  window.addEventListener(FULL_SYNC_EVENT, (e) => {
    const { module } = (e as CustomEvent).detail;
    void (async () => {
      const userId = await getUserId();
      if (!userId) return;
      for (const adapter of ADAPTER_ORDER) {
        if (adapter.module === module) {
          await mergeModule(adapter, await buildIdMap(userId));
        }
      }
    })();
  });
}

// ─── 全量同步 ───────────────────────────────────────────────────────────────

export interface FullSyncResult {
  [module: string]: { pushed: number; pulled: number; updated: number };
}

/**
 * 登录后全量双向合并所有模块（按依赖顺序）
 * 首次同步后标记 sync_meta.migrated，供设置页展示迁移状态
 */
export async function syncAllModules(): Promise<FullSyncResult> {
  const userId = await getUserId();
  if (!userId) return {};

  const results: FullSyncResult = {};
  const ctx = await buildIdMap(userId);

  for (const adapter of ADAPTER_ORDER) {
    try {
      results[adapter.module] = await mergeModule(adapter, ctx);
    } catch (e) {
      console.warn(`[sync] ${adapter.module} 全量同步失败:`, e);
      results[adapter.module] = { pushed: 0, pulled: 0, updated: 0 };
    }
  }

  // 同步完成后标记各模块迁移完成
  for (const module of new Set(ADAPTER_ORDER.map((a) => a.module))) {
    try {
      await markMigrated(module);
    } catch {
      // 标记失败不影响主流程
    }
  }

  // 用户资料单独同步
  try {
    await syncProfile();
  } catch (e) {
    console.warn('[sync] profile 同步失败:', e);
  }

  // 通知页面：全量同步已完成，可刷新 UI 展示最新数据
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SYNC_COMPLETE_EVENT));
  }

  return results;
}

// ─── 用户资料（特殊：id = auth.uid()）──────────────────────────────────────

/** 双向同步用户资料（云端为权威，本地仅缓存） */
export async function syncProfile(): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const supabase = createClient();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (data) {
    // 云端 → 本地缓存
    const db = await initProfileDB();
    const local: UserProfile = {
      id: 'default',
      nickname: (data.nickname as string) ?? '旅人',
      signature: (data.signature as string) ?? '',
      themeMode: (data.theme_mode as UserProfile['themeMode']) ?? 'auto',
      updatedAt: Date.now(),
    };
    await db.put('profile', local);
  } else {
    // 云端无资料（异常情况）→ 用本地资料补齐
    const local = await getUserProfile();
    await supabase.from('profiles').upsert({
      id: userId,
      nickname: local.nickname,
      signature: local.signature,
      theme_mode: local.themeMode ?? 'auto',
      updated_at: new Date().toISOString(),
    });
  }
}
