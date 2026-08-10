-- ============================================================
-- MindOS (life-os) Supabase 初始化迁移
-- 建表 + 索引 + RLS 行级安全策略
-- 在 Supabase Dashboard → SQL Editor 中执行本脚本
-- ============================================================

-- 启用 UUID 生成扩展（Supabase 已内置，幂等执行）
create extension if not exists pgcrypto;

-- ============================================================
-- 1. 用户资料（id 直接等于 auth.uid()）
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null default '旅人',
  signature text not null default '在心智的田野上，种下每一天',
  theme_mode text not null default 'auto', -- auto / light / dark
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 2. 日记回音
-- ============================================================
create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  mood_tags text[] not null default '{}',
  key_themes text[] not null default '{}',
  ai_feedback text,
  images jsonb not null default '[]', -- base64 压缩图数组，最多 8 张
  word_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_diary_entries_user_created
  on public.diary_entries (user_id, created_at desc);

create table if not exists public.diary_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period_type text not null, -- week / month
  period_start date not null,
  period_end date not null,
  summary_content text,
  emotion_trend jsonb,
  keyword_cloud jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_diary_summaries_user_period
  on public.diary_summaries (user_id, period_type, period_start);

-- ============================================================
-- 3. 思维藤蔓（知识库）
-- ============================================================
create table if not exists public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null, -- link / text / file / creation_article / feishu / obsidian
  title text not null,
  source_url text,
  raw_content text,
  ai_summary text,
  topic_tags text[] not null default '{}',
  source_platform text,
  publish_date timestamptz,
  external_id text, -- <source>:<native-id>，如 obsidian:<path> / feishu:<docToken>
  external_updated_at timestamptz,
  source_collection text, -- 来源集名称
  source_position text, -- 来源中的原始位置
  primary_category text, -- 一级主题
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_knowledge_items_user_created
  on public.knowledge_items (user_id, created_at desc);
create index if not exists idx_knowledge_items_user_type
  on public.knowledge_items (user_id, type);
create index if not exists idx_knowledge_items_user_category
  on public.knowledge_items (user_id, primary_category);
create index if not exists idx_knowledge_items_user_collection
  on public.knowledge_items (user_id, source_collection);
-- 每个用户的外部源唯一（用于导入去重）
create unique index if not exists idx_knowledge_items_user_external
  on public.knowledge_items (user_id, external_id) where external_id is not null;

create table if not exists public.knowledge_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_a_id uuid not null references public.knowledge_items (id) on delete cascade,
  item_b_id uuid not null references public.knowledge_items (id) on delete cascade,
  relation_type text not null, -- deepen / apply / supplement / oppose / source / contains
  ai_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_knowledge_links_user_item_a
  on public.knowledge_links (user_id, item_a_id);
create index if not exists idx_knowledge_links_user_item_b
  on public.knowledge_links (user_id, item_b_id);

create table if not exists public.topic_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  sub_topics text[] not null default '{}',
  is_builtin boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- ============================================================
-- 4. Todo 轻约
-- ============================================================
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  date text not null, -- YYYY-MM-DD
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_todos_user_date
  on public.todos (user_id, date);
create index if not exists idx_todos_user_created
  on public.todos (user_id, created_at desc);

-- ============================================================
-- 5. 心智日志 MindLog
-- ============================================================
create table if not exists public.mindlog_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null, -- daily / weekly / monthly
  period_start date not null, -- YYYY-MM-DD
  period_end date not null,
  keywords text, -- 核心关键词（如"灰调·重连"）
  content text, -- 完整结构化文本
  dashboard_summary text, -- 仪表盘短摘要
  source_data jsonb not null default '{}', -- { diaryCount, knowledgeCount, moodSummary }
  created_at timestamptz not null default now()
);

create unique index if not exists idx_mindlog_user_period
  on public.mindlog_reports (user_id, type, period_start);
create index if not exists idx_mindlog_user_created
  on public.mindlog_reports (user_id, created_at desc);

-- ============================================================
-- 6. 人生信笺
-- ============================================================
create table if not exists public.letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period_month text not null, -- YYYY-MM
  title text not null,
  content text not null,
  monthly_stats jsonb not null default '{}', -- { diaryCount, knowledgeCount, todoCompleted, moodSummary }
  created_at timestamptz not null default now()
);

create unique index if not exists idx_letters_user_month
  on public.letters (user_id, period_month);

-- ============================================================
-- 7. 镜像洞见（AI 对话）
-- ============================================================
create table if not exists public.mirror_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '新对话',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mirror_sessions_user_updated
  on public.mirror_sessions (user_id, updated_at desc);

create table if not exists public.mirror_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid references public.mirror_sessions (id) on delete cascade,
  role text not null, -- user / assistant
  content text not null,
  attachments jsonb not null default '[]', -- [{ type, name, data }]
  created_at timestamptz not null default now()
);

create index if not exists idx_mirror_messages_user_created
  on public.mirror_messages (user_id, created_at);
create index if not exists idx_mirror_messages_user_session
  on public.mirror_messages (user_id, session_id);

-- ============================================================
-- 8. 媒体订阅（RSS）
-- ============================================================
create table if not exists public.media_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null, -- wechat / xiaohongshu / zhihu / juejin / douyin / other
  rss_url text not null,
  nickname text not null,
  last_sync_at timestamptz,
  last_sync_status text, -- success / fail
  created_at timestamptz not null default now()
);

create index if not exists idx_media_configs_user
  on public.media_configs (user_id);

create table if not exists public.media_sync_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  config_id uuid references public.media_configs (id) on delete cascade,
  status text not null, -- success / fail
  items_count integer not null default 0,
  error_msg text,
  sync_at timestamptz not null default now()
);

create index if not exists idx_media_sync_logs_user
  on public.media_sync_logs (user_id, sync_at desc);

-- ============================================================
-- 9. 同步元数据（一键迁移标记）
-- ============================================================
create table if not exists public.sync_meta (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  module text not null, -- diary / knowledge / todo / mindlog / letters / mirror / media / profile
  migrated boolean not null default false,
  last_synced_at timestamptz,
  unique (user_id, module)
);

-- ============================================================
-- 10. updated_at 自动更新触发器
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_diary_entries_updated on public.diary_entries;
create trigger trg_diary_entries_updated
  before update on public.diary_entries
  for each row execute function public.set_updated_at();

drop trigger if exists trg_knowledge_items_updated on public.knowledge_items;
create trigger trg_knowledge_items_updated
  before update on public.knowledge_items
  for each row execute function public.set_updated_at();

drop trigger if exists trg_mirror_sessions_updated on public.mirror_sessions;
create trigger trg_mirror_sessions_updated
  before update on public.mirror_sessions
  for each row execute function public.set_updated_at();

-- ============================================================
-- 11. 启用 RLS + 行级安全策略
-- ============================================================
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

-- ─── profiles：id = auth.uid() ───
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

-- ─── 通用策略：user_id = auth.uid() ───
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
    execute format('drop policy if exists "%s_select_own" on public.%I', t, t);
    execute format('create policy "%s_select_own" on public.%I for select using (auth.uid() = user_id)', t, t);
    execute format('drop policy if exists "%s_insert_own" on public.%I', t, t);
    execute format('create policy "%s_insert_own" on public.%I for insert with check (auth.uid() = user_id)', t, t);
    execute format('drop policy if exists "%s_update_own" on public.%I', t, t);
    execute format('create policy "%s_update_own" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
    execute format('drop policy if exists "%s_delete_own" on public.%I', t, t);
    execute format('create policy "%s_delete_own" on public.%I for delete using (auth.uid() = user_id)', t, t);
  end loop;
end $$;

-- ============================================================
-- 12. 新用户注册时自动创建 profile
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname, signature)
  values (new.id, '旅人', '在心智的田野上，种下每一天')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 完成！脚本执行成功后，回到 Qoder 继续配置环境变量
-- ============================================================
