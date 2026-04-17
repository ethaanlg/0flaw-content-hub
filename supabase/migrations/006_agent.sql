-- supabase/migrations/006_agent.sql
-- Requires pgvector extension (enable in Supabase Extensions dashboard first)

create extension if not exists vector;

create table if not exists agent_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  proposal_type text not null check (proposal_type in ('post', 'thread', 'carousel', 'newsletter', 'repost')),
  platform text[],
  title text not null,
  content jsonb not null,
  justification text,
  suggested_at timestamptz default now(),
  optimal_publish_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'approved', 'edited', 'rejected')),
  reviewed_at timestamptz,
  post_id uuid references posts
);

create table if not exists agent_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  content text not null,
  embedding vector(1536),
  metadata jsonb,
  created_at timestamptz default now()
);

alter table agent_proposals enable row level security;
alter table agent_memory enable row level security;

create policy "Users see own proposals"
  on agent_proposals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users see own memory"
  on agent_memory for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index agent_proposals_user_status on agent_proposals(user_id, status);
create index agent_memory_user_id on agent_memory(user_id);
