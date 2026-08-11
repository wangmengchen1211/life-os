-- ============================================================
-- MindOS (life-os) 安全加固迁移
-- 幂等执行：确保全部业务表 RLS 已启用且四向策略完整
-- 在 Supabase Dashboard → SQL Editor 中执行本脚本
-- ============================================================

-- 1. 强制启用 RLS（已启用的表重复执行无副作用）
alter table public.profiles enable row level security;
alter table public.diary_entries enable row level security;
alter table public.diary_summaries enable row level security;
alter table public.knowledge_items enable row level security;
alter table public.knowledge_links enable row level security;
alter table public.topic_categories enable row level security;
alter table public.todos enable row level security;
alter table public.mindlog_reports enable row level security;
alter table public.letters enable row level security;
alter table public.mirror_sessions enable row level security;
alter table public.mirror_messages enable row level security;
alter table public.media_configs enable row level security;
alter table public.media_sync_logs enable row level security;
alter table public.sync_meta enable row level security;

-- 2. profiles：主键 id = auth.uid()
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = id);

-- 3. 其余 13 张表：user_id = auth.uid()（清理可能残留的宽松策略后重建）
do $$
declare
  t text;
begin
  foreach t in array array[
    'diary_entries', 'diary_summaries', 'knowledge_items', 'knowledge_links',
    'topic_categories', 'todos', 'mindlog_reports', 'letters',
    'mirror_sessions', 'mirror_messages', 'media_configs', 'media_sync_logs',
    'sync_meta'
  ] loop
    -- 删除任何非 *_own 命名的外来策略（防止历史遗留宽松策略）
    execute format(
      'drop policy if exists "%s_select_own" on public.%I', t, t);
    execute format(
      'drop policy if exists "%s_insert_own" on public.%I', t, t);
    execute format(
      'drop policy if exists "%s_update_own" on public.%I', t, t);
    execute format(
      'drop policy if exists "%s_delete_own" on public.%I', t, t);

    execute format('create policy "%s_select_own" on public.%I for select using (auth.uid() = user_id)', t, t);
    execute format('create policy "%s_insert_own" on public.%I for insert with check (auth.uid() = user_id)', t, t);
    execute format('create policy "%s_update_own" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
    execute format('create policy "%s_delete_own" on public.%I for delete using (auth.uid() = user_id)', t, t);
  end loop;
end $$;

-- 4. 验证查询：执行后应返回 14 行，且每行 policy_count >= 4
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  coalesce(n.policy_count, 0) as policy_count
from pg_class c
join pg_namespace ns on ns.oid = c.relnamespace
left join (
  select schemaname, tablename, count(*) as policy_count
  from pg_policies
  group by schemaname, tablename
) n on n.schemaname = ns.nspname and n.tablename = c.relname
where ns.nspname = 'public'
  and c.relname in (
    'profiles', 'diary_entries', 'diary_summaries', 'knowledge_items',
    'knowledge_links', 'topic_categories', 'todos', 'mindlog_reports',
    'letters', 'mirror_sessions', 'mirror_messages', 'media_configs',
    'media_sync_logs', 'sync_meta'
  )
order by c.relname;
