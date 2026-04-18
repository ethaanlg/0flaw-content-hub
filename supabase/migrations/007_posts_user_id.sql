-- supabase/migrations/007_posts_user_id.sql
-- Adds user_id to posts table so RLS in migrations 003 and 005 works correctly.

-- Add user_id column (nullable first so existing rows don't fail)
alter table posts
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Add content_type and payload columns used by publish-scheduled cron
alter table posts
  add column if not exists content_type text not null default 'carousel';

alter table posts
  add column if not exists payload jsonb;

-- Add 'publishing' to the status check constraint
alter table posts
  drop constraint if exists posts_status_check;

alter table posts
  add constraint posts_status_check
  check (status in ('draft', 'scheduled', 'publishing', 'published', 'failed'));

-- Enable RLS
alter table posts enable row level security;

drop policy if exists "posts_select_own" on posts;
drop policy if exists "posts_insert_own" on posts;
drop policy if exists "posts_update_own" on posts;
drop policy if exists "posts_delete_own" on posts;

create policy "posts_select_own" on posts
  for select using (auth.uid() = user_id);

create policy "posts_insert_own" on posts
  for insert with check (auth.uid() = user_id);

create policy "posts_update_own" on posts
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "posts_delete_own" on posts
  for delete using (auth.uid() = user_id);

-- Index for cron query: posts by user + status
create index if not exists idx_posts_user_id on posts(user_id);
