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
