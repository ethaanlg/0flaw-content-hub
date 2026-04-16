-- supabase/migrations/002_platform_connections.sql

create table if not exists platform_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  platform text not null check (platform in ('linkedin','instagram','x','threads')),
  account_id text not null,
  account_name text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scopes text[],
  connected_at timestamptz default now(),
  unique(user_id, platform, account_id)
);

alter table platform_connections enable row level security;

create policy "Users see own connections"
  on platform_connections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index platform_connections_user_id on platform_connections(user_id);
create index platform_connections_platform on platform_connections(user_id, platform);
