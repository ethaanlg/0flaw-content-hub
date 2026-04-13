-- ============================================================
-- 0Flaw Content Hub — Supabase Schema
-- Coller dans l'éditeur SQL de ton projet Supabase
-- ============================================================

-- Posts table
create table if not exists posts (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  title               text not null,
  topic               text,
  description         text,
  status              text not null default 'draft'
                        check (status in ('draft', 'scheduled', 'published', 'failed')),
  platforms           text[] not null default '{}',
  scheduled_at        timestamptz,
  published_at        timestamptz,
  pdf_url             text,
  slides_urls         text[],
  linkedin_post_id    text,
  instagram_post_id   text
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger posts_updated_at
  before update on posts
  for each row execute function update_updated_at();

-- Post stats table
create table if not exists post_stats (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid references posts(id) on delete cascade,
  collected_at    timestamptz default now(),
  platform        text not null check (platform in ('linkedin', 'instagram')),
  impressions     int default 0,
  reach           int default 0,
  likes           int default 0,
  comments        int default 0,
  shares          int default 0,
  clicks          int default 0,
  saves           int default 0,
  engagement_rate float generated always as (
    case when impressions > 0
    then round((((likes + comments + shares + saves)::numeric / impressions) * 100), 2)
    else 0 end
  ) stored
);

-- RLS
alter table posts enable row level security;
alter table post_stats enable row level security;

create policy "Allow all" on posts for all using (true);
create policy "Allow all" on post_stats for all using (true);

-- Index
create index if not exists posts_status_scheduled on posts (status, scheduled_at);
create index if not exists post_stats_post_platform on post_stats (post_id, platform);

-- ============================================================
-- Migration 2026-04-13 : Auth multi-tenant + user_settings
-- À exécuter dans l'éditeur SQL du dashboard Supabase
-- ============================================================

-- 1. Ajouter user_id aux tables existantes
alter table posts add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table post_stats add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 2. Supprimer les anciennes policies permissives
drop policy if exists "Allow all" on posts;
drop policy if exists "Allow all" on post_stats;

-- 3. RLS stricte sur posts : l'utilisateur ne voit que ses posts
create policy "Users see own posts" on posts
  for select using (auth.uid() = user_id);

create policy "Users insert own posts" on posts
  for insert with check (auth.uid() = user_id);

create policy "Users update own posts" on posts
  for update using (auth.uid() = user_id);

create policy "Users delete own posts" on posts
  for delete using (auth.uid() = user_id);

-- 4. RLS stricte sur post_stats
create policy "Users see own stats" on post_stats
  for select using (auth.uid() = user_id);

create policy "Users insert own stats" on post_stats
  for insert with check (auth.uid() = user_id);

-- 5. Index sur user_id pour les perfs
create index if not exists posts_user_id on posts (user_id);
create index if not exists post_stats_user_id on post_stats (user_id);

-- 6. Table user_settings (pour Task 5)
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  week_goal int not null default 2,
  optimal_days int[] not null default '{2,4}',
  optimal_hour int not null default 8,
  default_platforms text[] not null default '{"linkedin","instagram"}',
  ai_model text not null default 'claude-sonnet-4-6',
  linkedin_connected boolean not null default false,
  instagram_connected boolean not null default false,
  updated_at timestamptz default now()
);

alter table user_settings enable row level security;

create policy "Users see own settings" on user_settings
  for select using (auth.uid() = user_id);

create policy "Users upsert own settings" on user_settings
  for insert with check (auth.uid() = user_id);

create policy "Users update own settings" on user_settings
  for update using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- Migration: topic library + text post support
-- ─────────────────────────────────────────────────────────────

-- Extend posts table
alter table posts add column if not exists content_type text not null default 'carousel';
alter table posts add column if not exists linkedin_text text;
alter table posts add column if not exists instagram_text text;

-- User topics
create table if not exists user_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'custom',
  created_at timestamptz not null default now()
);

alter table user_topics enable row level security;

drop policy if exists "user_topics_rls" on user_topics;
create policy "user_topics_rls" on user_topics
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
