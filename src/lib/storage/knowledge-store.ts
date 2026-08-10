import { openDB, type IDBPDatabase } from 'idb';
import { notifyUpsert, notifyDelete, notifyFullSync } from '@/lib/sync/cloud';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface KnowledgeItem {
  id?: number;
  /** 云端 UUID（Supabase 同步用） */
  cloudId?: string;
  type: 'link' | 'text' | 'file' | 'creation_article' | 'feishu' | 'obsidian';
  title: string;
  sourceUrl?: string;
  rawContent?: string;
  aiSummary?: string;
  topicTags: string[];
  sourcePlatform?: string;
  publishDate?: string;
  /** 外部源唯一标识，格式：`<source>:<native-id>`，如 `obsidian:<relativePath>` / `feishu:<docToken>` */
  externalId?: string;
  /** 外部源最后更新时间（ISO），用于增量判定 */
  externalUpdatedAt?: string;
  /** 来源集名称（如"飞书·产品知识库"、"Obsidian·个人笔记"） */
  sourceCollection?: string;
  /** 来源中的原始位置（文件夹路径、章节顺序） */
  sourcePosition?: string;
  /** 一级主题（从预设列表选取） */
  primaryCategory?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeLink {
  id?: number;
  /** 云端 UUID（Supabase 同步用） */
  cloudId?: string;
  itemAId: number;
  itemBId: number;
  relationType: string;
  aiReason?: string;
  createdAt: string;
}

export type RelationType = 'deepen' | 'apply' | 'supplement' | 'oppose' | 'source' | 'contains';

export const RELATION_TYPE_LABELS: Record<RelationType, string> = {
  deepen: '深化',
  apply: '应用',
  supplement: '补充',
  oppose: '对立',
  source: '来源',
  contains: '包含',
};

export interface TopicCategory {
  id?: number;
  /** 云端 UUID（Supabase 同步用） */
  cloudId?: string;
  name: string;
  subTopics: string[];
  isBuiltin: boolean;
  createdAt: string;
}

// 预设一级主题
export const DEFAULT_CATEGORIES = [
  '认知与思维', '学习与教育', '科学与技术', '人文与社科',
  '商业与职业', '创意与表达', '生活与健康', '关系与沟通',
  '财富与资源', '兴趣与爱好', '社会与人文', '信念与内在',
];

export interface ListItemsOptions {
  type?: KnowledgeItem['type'];
  offset?: number;
  limit?: number;
}

export interface SearchFilters {
  type?: KnowledgeItem['type'];
  tag?: string;
}

export interface Stats {
  totalItems: number;
  typeBreakdown: Record<string, number>;
}

export interface GraphNode {
  id: number;
  title: string;
  type: string;
  primaryCategory?: string;
}

export interface GraphEdge {
  source: number;
  target: number;
  relationType: string;
  aiReason?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ─── Database ────────────────────────────────────────────────────────────────

const DB_NAME = 'knowledge-db';
const DB_VERSION = 4;

let dbInstance: IDBPDatabase | null = null;

export async function initDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, tx) {
      // v1: items store
      if (!db.objectStoreNames.contains('items')) {
        const itemsStore = db.createObjectStore('items', {
          keyPath: 'id',
          autoIncrement: true,
        });
        itemsStore.createIndex('by-type', 'type');
        itemsStore.createIndex('by-tags', 'topicTags', { multiEntry: true });
        itemsStore.createIndex('by-created', 'createdAt');
      }

      // v1: links store
      if (!db.objectStoreNames.contains('links')) {
        const linksStore = db.createObjectStore('links', {
          keyPath: 'id',
          autoIncrement: true,
        });
        linksStore.createIndex('by-itemA', 'itemAId');
        linksStore.createIndex('by-itemB', 'itemBId');
      }

      // v3: by-external 索引（用于飞书/Obsidian 导入增量去重）
      if (oldVersion < 3) {
        const itemsStore = tx.objectStore('items');
        if (!itemsStore.indexNames.contains('by-external')) {
          // 非 unique：存量 item 可能没有 externalId（undefined），多条 undefined 不应报冲突
          itemsStore.createIndex('by-external', 'externalId', { unique: false });
        }
      }

      // v4: 一级主题分类体系 + 来源集索引
      if (oldVersion < 4) {
        const itemsStore = tx.objectStore('items');
        if (!itemsStore.indexNames.contains('by-category')) {
          itemsStore.createIndex('by-category', 'primaryCategory');
        }
        if (!itemsStore.indexNames.contains('by-source-collection')) {
          itemsStore.createIndex('by-source-collection', 'sourceCollection');
        }

        // 创建 topic-categories store
        const catStore = db.createObjectStore('topic-categories', {
          keyPath: 'id',
          autoIncrement: true,
        });
        catStore.createIndex('by-name', 'name', { unique: true });

        // 预设一级主题初始化
        for (const name of DEFAULT_CATEGORIES) {
          catStore.add({
            name,
            subTopics: [],
            isBuiltin: true,
            createdAt: new Date().toISOString(),
          });
        }
      }
    },
  });

  return dbInstance;
}

// ─── Items CRUD ──────────────────────────────────────────────────────────────

export async function addItem(item: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<KnowledgeItem, 'createdAt' | 'updatedAt'>>): Promise<number> {
  const db = await initDB();
  const now = new Date().toISOString();
  const record: KnowledgeItem = {
    ...item,
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now,
  };
  const id = await db.add('items', record);
  notifyUpsert('knowledge_items', id as number);
  return id as number;
}

export async function getItem(id: number): Promise<KnowledgeItem | undefined> {
  const db = await initDB();
  return db.get('items', id);
}

export async function updateItem(id: number, updates: Partial<Omit<KnowledgeItem, 'id'>>): Promise<void> {
  const db = await initDB();
  const existing = await db.get('items', id);
  if (!existing) throw new Error(`Item ${id} not found`);

  const updated: KnowledgeItem = {
    ...existing,
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };
  await db.put('items', updated);
  notifyUpsert('knowledge_items', id);
}

/**
 * 按 externalId 查询条目（飞书/Obsidian 导入去重用）
 */
export async function getItemByExternalId(externalId: string): Promise<KnowledgeItem | undefined> {
  const db = await initDB();
  return db.getFromIndex('items', 'by-external', externalId);
}

/**
 * 按 externalId upsert：
 * - 不存在 → 插入，返回 { id, action: 'inserted' }
 * - 存在且 externalUpdatedAt 未变 → 跳过，返回 { id, action: 'skipped' }
 * - 存在且已更新 → 更新 rawContent/title/externalUpdatedAt，返回 { id, action: 'updated' }
 */
export async function upsertByExternalId(
  externalId: string,
  payload: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt' | 'externalId'> & {
    externalUpdatedAt?: string;
  }
): Promise<{ id: number; action: 'inserted' | 'updated' | 'skipped' }> {
  const existing = await getItemByExternalId(externalId);
  if (!existing) {
    const id = await addItem({ ...payload, externalId });
    return { id, action: 'inserted' };
  }

  // 增量判定：externalUpdatedAt 一致则跳过
  if (
    payload.externalUpdatedAt &&
    existing.externalUpdatedAt &&
    payload.externalUpdatedAt === existing.externalUpdatedAt
  ) {
    return { id: existing.id!, action: 'skipped' };
  }

  await updateItem(existing.id!, {
    title: payload.title,
    rawContent: payload.rawContent,
    sourceUrl: payload.sourceUrl,
    sourcePlatform: payload.sourcePlatform,
    externalUpdatedAt: payload.externalUpdatedAt,
  });
  return { id: existing.id!, action: 'updated' };
}

export async function deleteItem(id: number): Promise<void> {
  const db = await initDB();
  const item = await db.get('items', id);

  const tx = db.transaction(['items', 'links'], 'readwrite');

  // Delete the item
  await tx.objectStore('items').delete(id);

  // Delete related links
  const linksStore = tx.objectStore('links');
  const allLinks = await linksStore.getAll();
  const relatedLinks: KnowledgeLink[] = [];
  for (const link of allLinks) {
    if (link.itemAId === id || link.itemBId === id) {
      relatedLinks.push(link);
      await linksStore.delete(link.id);
    }
  }

  await tx.done;

  // 同步删除云端条目与关联链接
  notifyDelete('knowledge_items', item?.cloudId);
  for (const link of relatedLinks) {
    notifyDelete('knowledge_links', link.cloudId);
  }
}

export async function listItems(options?: ListItemsOptions): Promise<KnowledgeItem[]> {
  const db = await initDB();
  let items: KnowledgeItem[];

  if (options?.type) {
    items = await db.getAllFromIndex('items', 'by-type', options.type);
  } else {
    items = await db.getAll('items');
  }

  // Sort by createdAt descending
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Pagination
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? items.length;
  return items.slice(offset, offset + limit);
}

export async function searchItems(query: string, filters?: SearchFilters): Promise<KnowledgeItem[]> {
  const db = await initDB();
  let items: KnowledgeItem[];

  if (filters?.tag) {
    items = await db.getAllFromIndex('items', 'by-tags', filters.tag);
  } else if (filters?.type) {
    items = await db.getAllFromIndex('items', 'by-type', filters.type);
  } else {
    items = await db.getAll('items');
  }

  // Apply type filter if tag was used for initial fetch
  if (filters?.tag && filters?.type) {
    items = items.filter((item) => item.type === filters.type);
  }

  // Fuzzy search on title and rawContent
  const lowerQuery = query.toLowerCase();
  return items.filter((item) => {
    const titleMatch = item.title.toLowerCase().includes(lowerQuery);
    const contentMatch = item.rawContent?.toLowerCase().includes(lowerQuery) ?? false;
    return titleMatch || contentMatch;
  });
}

// ─── Links CRUD ──────────────────────────────────────────────────────────────

export async function addLink(link: Omit<KnowledgeLink, 'id' | 'createdAt'> & Partial<Pick<KnowledgeLink, 'createdAt'>>): Promise<number> {
  const db = await initDB();
  const record: KnowledgeLink = {
    ...link,
    createdAt: link.createdAt || new Date().toISOString(),
  };
  const id = await db.add('links', record);
  notifyUpsert('knowledge_links', id as number);
  return id as number;
}

export async function deleteLink(id: number): Promise<void> {
  const db = await initDB();
  const existing = await db.get('links', id);
  await db.delete('links', id);
  notifyDelete('knowledge_links', existing?.cloudId);
}

export async function listLinks(itemId?: number): Promise<KnowledgeLink[]> {
  const db = await initDB();

  if (itemId === undefined) {
    return db.getAll('links');
  }

  const [byA, byB] = await Promise.all([
    db.getAllFromIndex('links', 'by-itemA', itemId),
    db.getAllFromIndex('links', 'by-itemB', itemId),
  ]);

  // Deduplicate by id
  const map = new Map<number, KnowledgeLink>();
  for (const link of [...byA, ...byB]) {
    map.set(link.id!, link);
  }
  return Array.from(map.values());
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export async function getStats(): Promise<Stats> {
  const db = await initDB();
  const items = await db.getAll('items');

  const typeBreakdown: Record<string, number> = {};
  for (const item of items) {
    typeBreakdown[item.type] = (typeBreakdown[item.type] || 0) + 1;
  }

  return {
    totalItems: items.length,
    typeBreakdown,
  };
}

export async function getGraphData(): Promise<GraphData> {
  const db = await initDB();
  const [items, links] = await Promise.all([
    db.getAll('items'),
    db.getAll('links'),
  ]);

  const nodes: GraphNode[] = items.map((item) => ({
    id: item.id!,
    title: item.title,
    type: item.type,
    primaryCategory: item.primaryCategory,
  }));

  const edges: GraphEdge[] = links.map((link) => ({
    source: link.itemAId,
    target: link.itemBId,
    relationType: link.relationType,
    aiReason: link.aiReason,
  }));

  return { nodes, edges };
}

// ─── Tagging Context ───────────────────────────────────────────────────────────

/**
 * 获取打标上下文（所有已有标签 + 一级主题列表）
 */
export async function getTaggingContext(): Promise<{
  existingTags: string[];
  categories: string[];
}> {
  const db = await initDB();
  const items: KnowledgeItem[] = await db.getAll('items');
  const tagSet = new Set<string>();
  for (const item of items) {
    if (item.topicTags) {
      for (const tag of item.topicTags) {
        tagSet.add(tag);
      }
    }
  }

  const cats: TopicCategory[] = await db.getAll('topic-categories');
  return {
    existingTags: Array.from(tagSet).sort(),
    categories: cats.map((c) => c.name),
  };
}

// ─── Topic Categories CRUD ──────────────────────────────────────────────────────

export async function listCategories(): Promise<TopicCategory[]> {
  const db = await initDB();
  return db.getAll('topic-categories');
}

export async function addCategory(name: string): Promise<number> {
  const db = await initDB();
  const id = await db.add('topic-categories', {
    name,
    subTopics: [],
    isBuiltin: false,
    createdAt: new Date().toISOString(),
  });
  notifyUpsert('topic_categories', id as number);
  return id as number;
}

export async function updateCategory(id: number, updates: Partial<TopicCategory>): Promise<void> {
  const db = await initDB();
  const existing = await db.get('topic-categories', id);
  if (!existing) throw new Error(`TopicCategory ${id} not found`);
  await db.put('topic-categories', { ...existing, ...updates, id });
  notifyUpsert('topic_categories', id);
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await initDB();
  const existing = await db.get('topic-categories', id);
  await db.delete('topic-categories', id);
  notifyDelete('topic_categories', existing?.cloudId);
}

// ─── Tag Stats & Management ─────────────────────────────────────────────────────

/**
 * 统计每个标签的使用次数
 */
export async function getTagStats(): Promise<{ tag: string; count: number }[]> {
  const db = await initDB();
  const items: KnowledgeItem[] = await db.getAll('items');
  const countMap = new Map<string, number>();
  for (const item of items) {
    if (item.topicTags) {
      for (const tag of item.topicTags) {
        countMap.set(tag, (countMap.get(tag) || 0) + 1);
      }
    }
  }
  return Array.from(countMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 合并标签：把 oldTags 替换为 newTag，返回受影响条目数
 */
export async function mergeTags(oldTags: string[], newTag: string): Promise<number> {
  const db = await initDB();
  const items: KnowledgeItem[] = await db.getAll('items');
  let affected = 0;

  const tx = db.transaction('items', 'readwrite');
  const store = tx.objectStore('items');

  for (const item of items) {
    if (!item.topicTags) continue;
    const hasOld = item.topicTags.some((t) => oldTags.includes(t));
    if (!hasOld) continue;

    const filtered = item.topicTags.filter((t) => !oldTags.includes(t));
    if (!filtered.includes(newTag)) {
      filtered.push(newTag);
    }
    await store.put({ ...item, topicTags: filtered, updatedAt: new Date().toISOString() });
    affected++;
  }

  await tx.done;
  notifyFullSync('knowledge');
  return affected;
}

/**
 * 移除指定标签，返回受影响条目数
 */
export async function removeTag(tag: string): Promise<number> {
  const db = await initDB();
  const items: KnowledgeItem[] = await db.getAll('items');
  let affected = 0;

  const tx = db.transaction('items', 'readwrite');
  const store = tx.objectStore('items');

  for (const item of items) {
    if (!item.topicTags || !item.topicTags.includes(tag)) continue;
    const filtered = item.topicTags.filter((t) => t !== tag);
    await store.put({ ...item, topicTags: filtered, updatedAt: new Date().toISOString() });
    affected++;
  }

  await tx.done;
  notifyFullSync('knowledge');
  return affected;
}

// ─── Hierarchy (Parent-Child) ────────────────────────────────────────────────────

/**
 * 获取某条目的子级条目
 */
export async function getChildItems(parentId: number): Promise<KnowledgeItem[]> {
  const db = await initDB();
  const links = await db.getAllFromIndex('links', 'by-itemA', parentId);
  const childLinks = links.filter((l: KnowledgeLink) => l.relationType === 'contains');
  const children: KnowledgeItem[] = [];
  for (const link of childLinks) {
    const item = await db.get('items', link.itemBId);
    if (item) children.push(item);
  }
  return children;
}

/**
 * 设置父子关系（一个子级只能有一个父级）
 */
export async function setParent(childId: number, parentId: number): Promise<void> {
  const db = await initDB();
  // 先删除该子级已有的 contains 关系
  const existingLinks = await db.getAllFromIndex('links', 'by-itemB', childId);
  for (const link of existingLinks) {
    if (link.relationType === 'contains' && link.id) {
      await db.delete('links', link.id);
    }
  }
  // 创建新关系
  await db.add('links', {
    itemAId: parentId,
    itemBId: childId,
    relationType: 'contains',
    aiReason: '用户手动设置层级',
    createdAt: new Date().toISOString(),
  });
  notifyFullSync('knowledge');
}

/**
 * 移除某子级的父子关系
 */
export async function removeParent(childId: number): Promise<void> {
  const db = await initDB();
  const links = await db.getAllFromIndex('links', 'by-itemB', childId);
  for (const link of links) {
    if (link.relationType === 'contains' && link.id) {
      await db.delete('links', link.id);
    }
  }
  notifyFullSync('knowledge');
}

/**
 * 获取所有 contains 类型的 link（用于构建层级映射）
 */
export async function listContainsLinks(): Promise<KnowledgeLink[]> {
  const db = await initDB();
  const allLinks: KnowledgeLink[] = await db.getAll('links');
  return allLinks.filter((l) => l.relationType === 'contains');
}

// ─── Source Collection Queries ──────────────────────────────────────────────────

/**
 * 获取所有来源集及对应条目数
 */
export async function getSourceCollections(): Promise<{ name: string; count: number }[]> {
  const db = await initDB();
  const items: KnowledgeItem[] = await db.getAll('items');
  const countMap = new Map<string, number>();

  for (const item of items) {
    if (item.sourceCollection) {
      countMap.set(item.sourceCollection, (countMap.get(item.sourceCollection) || 0) + 1);
    }
  }

  return Array.from(countMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 按来源集查询条目（使用 by-source-collection 索引）
 */
export async function listItemsBySourceCollection(collection: string): Promise<KnowledgeItem[]> {
  const db = await initDB();
  return db.getAllFromIndex('items', 'by-source-collection', collection);
}
