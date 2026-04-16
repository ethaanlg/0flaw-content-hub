create table if not exists post_publications (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts on delete cascade,
  platform text not null check (platform in ('linkedin','instagram','x','threads')),
  external_id text,
  published_at timestamptz,
  status text not null default 'pending' check (status in ('pending','success','failed')),
  error_message text,
  analytics_last_sync timestamptz,
  created_at timestamptz default now()
);

alter table post_publications enable row level security;

create policy "Users see own post publications"
  on post_publications for all
  using (
    exists (
      select 1 from posts where posts.id = post_publications.post_id
        and posts.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from posts where posts.id = post_publications.post_id
        and posts.user_id = auth.uid()
    )
  );

create index post_publications_post_id on post_publications(post_id);
create index post_publications_platform on post_publications(platform);
create index post_publications_status on post_publications(status);
