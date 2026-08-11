import { createClient } from '@/lib/supabase/client';

// ═══════════════════════════════════════════════════════════════════════════
// Supabase 云同步核心
// 设计原则：
// - store 层写操作后通过 notifyXxx() 发出本地变更事件，本模块监听后推送到云端
// - 登录后调用 mergeModule() 做双向合并（按 updated_at 时间戳，新者胜）
// - 本地记录通过 cloudId 字段（可选 string）映射云端 UUID
// ═══════════════════════════════════════════════════════════════════════════

export type CloudRow = Record<string, unknown>;

/** 获取当前登录用户 ID（未登录返回 null） */
export async function getUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** 拉取某表当前用户的全部数据 */
export async function fetchAllRows(table: string): Promise<CloudRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw error;
  return (data ?? []) as CloudRow[];
}

/** 插入一行，返回云端 uuid */
export async function insertRow(table: string, payload: CloudRow): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

/** 按 id 更新一行 */
export async function updateRow(
  table: string,
  id: string,
  patch: CloudRow,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from(table).update(patch).eq('id', id);
  if (error) throw error;
}

/** 按 id 删除一行 */
export async function deleteRow(table: string, id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

/** 云端是否已存在该行（外部删除判断） */
async function cloudRowExists(table: string, uuid: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from(table)
    .select('id')
    .eq('id', uuid)
    .maybeSingle();
  return !!data;
}

// ─── 同步元数据（sync_meta）───────────────────────────────────────────────

/** 标记某模块首次迁移完成 */
export async function markMigrated(module: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  const supabase = createClient();
  await supabase.from('sync_meta').upsert(
    {
      user_id: userId,
      module,
      migrated: true,
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,module' },
  );
}

/** 查询某模块迁移状态 */
export async function isMigrated(module: string): Promise<boolean> {
  const userId = await getUserId();
  if (!userId) return false;
  const supabase = createClient();
  const { data } = await supabase
    .from('sync_meta')
    .select('migrated')
    .eq('user_id', userId)
    .eq('module', module)
    .maybeSingle();
  return data?.migrated ?? false;
}

// ─── 本地变更事件（store → 云端推送）─────────────────────────────────────

export const LOCAL_UPSERT_EVENT = 'mindos:local-upsert';
export const LOCAL_DELETE_EVENT = 'mindos:local-delete';
export const FULL_SYNC_EVENT = 'mindos:full-sync';
/** 全量同步完成事件（页面可监听此事件刷新 UI） */
export const SYNC_COMPLETE_EVENT = 'mindos:sync-complete';

/** 本地新增/更新后通知同步层（fire-and-forget，不阻塞 UI） */
export function notifyUpsert(table: string, localId: number): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(LOCAL_UPSERT_EVENT, { detail: { table, localId } }),
  );
}

/** 本地删除前通知同步层（携带 cloudId 以便删除云端对应行） */
export function notifyDelete(table: string, cloudId?: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(LOCAL_DELETE_EVENT, { detail: { table, cloudId } }),
  );
}

/** 批量操作后触发模块全量双向合并（如标签合并、级联删除等） */
export function notifyFullSync(module: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(FULL_SYNC_EVENT, { detail: { module } }),
  );
}

// ─── 通用双向合并引擎 ──────────────────────────────────────────────────────

export interface MergeContext {
  userId: string;
  /** 本地 id → 云端 uuid（跨模块共享，供子表引用父表时映射） */
  idMap: Map<number, string>;
  /** 云端 uuid → 本地 id（合并过程中动态构建，供子表反映射） */
  reverseIdMap: Map<string, number>;
}

export interface MergeAdapter<T extends { id?: number }> {
  /** Supabase 表名（同时作为事件 table 标识） */
  table: string;
  /** sync_meta 模块名 */
  module: string;
  /** 读取本地全部记录 */
  listLocal(): Promise<T[]>;
  /** 写入本地（id 不存在则新增并返回新 id） */
  putLocal(record: T): Promise<number>;
  /** 删除本地 */
  deleteLocal(id: number): Promise<void>;
  /** 本地记录 → 云端行（不含 id，需含 user_id） */
  toPayload(local: T, ctx: MergeContext): CloudRow;
  /** 云端行 → 本地记录（id 留空由 putLocal 分配） */
  toLocal(row: CloudRow, ctx: MergeContext): T;
  /** 本地时间戳（冲突比较） */
  localTimestamp(local: T): string;
  /** 云端时间戳（冲突比较） */
  rowTimestamp(row: CloudRow): string;
  /** 本地记录的云端 uuid */
  cloudIdOf(local: T): string | undefined;
  /** 为本地记录写入云端 uuid 后返回新记录 */
  withCloudId(local: T, uuid: string): T;
}

export interface MergeResult {
  pushed: number;
  pulled: number;
  updated: number;
}

/** 单条推送：云端无 → insert；有 → 按时间戳比较后 update */
export async function pushOne<T extends { id?: number }>(
  adapter: MergeAdapter<T>,
  local: T,
  ctx: MergeContext,
): Promise<void> {
  const uuid = adapter.cloudIdOf(local);
  const payload = adapter.toPayload(local, ctx);
  if (!uuid) {
    const newUuid = await insertRow(adapter.table, payload);
    await adapter.putLocal(adapter.withCloudId(local, newUuid));
  } else if (await cloudRowExists(adapter.table, uuid)) {
    await updateRow(adapter.table, uuid, payload);
  } else {
    // 云端被外部删除 → 重新上传生成新 uuid
    const newUuid = await insertRow(adapter.table, payload);
    await adapter.putLocal(adapter.withCloudId(local, newUuid));
  }
}

/**
 * 模块双向合并：
 * 1. 本地有 cloudId → 与云端按时间戳合并（新者胜），云端缺失则重新上传
 * 2. 本地无 cloudId → 上传云端
 * 3. 云端有而本地无 → 插入本地
 */
export async function mergeModule<T extends { id?: number }>(
  adapter: MergeAdapter<T>,
  sharedCtx?: MergeContext,
): Promise<MergeResult> {
  const userId = await getUserId();
  if (!userId) return { pushed: 0, pulled: 0, updated: 0 };

  const ctx: MergeContext = sharedCtx ?? {
    userId,
    idMap: new Map(),
    reverseIdMap: new Map(),
  };
  ctx.userId = userId;

  const [cloudRows, localRows] = await Promise.all([
    fetchAllRows(adapter.table),
    adapter.listLocal(),
  ]);

  const result: MergeResult = { pushed: 0, pulled: 0, updated: 0 };

  // 1) 本地有 cloudId → 与云端合并
  for (const local of localRows) {
    const uuid = adapter.cloudIdOf(local);
    if (!uuid) continue;
    ctx.idMap.set(local.id!, uuid);

    const row = cloudRows.find((r) => r.id === uuid);
    if (!row) {
      // 云端不存在（外部删除）→ 重新上传
      const newUuid = await insertRow(adapter.table, adapter.toPayload(local, ctx));
      await adapter.putLocal(adapter.withCloudId(local, newUuid));
      result.pushed++;
      continue;
    }

    const localTs = Date.parse(adapter.localTimestamp(local));
    const rowTs = Date.parse(adapter.rowTimestamp(row));
    if (rowTs > localTs) {
      // 云端新 → 覆盖本地（保留原本地 id 与 cloudId）
      const fresh = adapter.toLocal(row, ctx);
      await adapter.putLocal(adapter.withCloudId({ ...fresh, id: local.id }, uuid));
      result.pulled++;
    } else if (localTs > rowTs) {
      // 本地新 → 更新云端
      await updateRow(adapter.table, uuid, adapter.toPayload(local, ctx));
      result.updated++;
    }
  }

  // 2) 本地无 cloudId → 上传云端
  for (const local of localRows) {
    if (adapter.cloudIdOf(local)) continue;
    try {
      const newUuid = await insertRow(
        adapter.table,
        adapter.toPayload(local, ctx),
      );
      await adapter.putLocal(adapter.withCloudId(local, newUuid));
      ctx.idMap.set(local.id!, newUuid);
      result.pushed++;
    } catch (e) {
      // 唯一约束冲突（如 external_id / 同 period）→ 该行已在云端，忽略
      console.warn(`[sync] ${adapter.table} 上传失败（可能已在云端）`, e);
    }
  }

  // 3) 云端有而本地无 → 插入本地
  const localCloudIds = new Set(
    localRows.map((r) => adapter.cloudIdOf(r)).filter(Boolean),
  );
  for (const row of cloudRows) {
    const id = row.id as string;
    if (localCloudIds.has(id)) continue;
    try {
      const localRecord = adapter.toLocal(row, ctx);
      const newLocalId = await adapter.putLocal(localRecord);
      // 补写 cloudId，保持本地记录可追踪
      await adapter.putLocal(
        adapter.withCloudId({ ...localRecord, id: newLocalId }, id),
      );
      ctx.idMap.set(newLocalId, id);
      ctx.reverseIdMap.set(id, newLocalId);
      result.pulled++;
    } catch (e) {
      // 本地唯一索引冲突（by-name / by-period）→ 已存在，忽略
      console.warn(`[sync] ${adapter.table} 落盘失败（可能已存在）`, e);
    }
  }

  return result;
}
