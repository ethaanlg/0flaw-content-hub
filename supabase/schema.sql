-- 0Flaw Content Hub — Schéma Supabase
-- À exécuter dans : supabase.com → votre projet → SQL Editor

-- Table des comptes sociaux connectés
create table social_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('linkedin', 'instagram')),
  account_id text not null,
  account_name text,
  access_token text not null,
  token_expires_at timestamptz,
  created_at timestamptz default now()
);

-- Table des posts
create table posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  topic text,
  description text,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'failed')),
  platforms text[] not null default '{}',
  scheduled_at timestamptz,
  published_at timestamptz,
  linkedin_post_id text,
  instagram_post_id text,
  pdf_url text,
  slides_urls text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Table des statistiques par post
create table post_stats (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  platform text not null check (platform in ('linkedin', 'instagram')),
  collected_at timestamptz default now(),
  impressions integer default 0,
  reach integer default 0,
  likes integer default 0,
  comments integer default 0,
  shares integer default 0,
  saves integer default 0,
  clicks integer default 0,
  engagement_rate numeric(5,2) default 0
);

-- Index pour les requêtes fréquentes
create index idx_posts_status on posts(status);
create index idx_posts_scheduled_at on posts(scheduled_at);
create index idx_post_stats_post_id on post_stats(post_id);
create index idx_post_stats_collected_at on post_stats(collected_at);

-- Vue : meilleur créneau de publication par jour/heure
create or replace view best_posting_times as
select
  platform,
  extract(dow from p.scheduled_at) as day_of_week,
  extract(hour from p.scheduled_at) as hour_of_day,
  round(avg(s.engagement_rate), 2) as avg_engagement,
  count(*) as post_count
from posts p
join post_stats s on s.post_id = p.id
where p.status = 'published'
  and s.collected_at >= now() - interval '90 days'
group by platform, day_of_week, hour_of_day
having count(*) >= 2
order by avg_engagement desc;

-- Mise à jour automatique du champ updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger posts_updated_at
  before update on posts
  for each row execute function update_updated_at();
