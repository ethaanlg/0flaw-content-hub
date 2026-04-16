create table if not exists post_analytics (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid references post_publications on delete cascade,
  snapshot_at timestamptz default now(),
  impressions bigint default 0,
  reach bigint default 0,
  likes int default 0,
  comments int default 0,
  shares int default 0,
  saves int default 0,
  clicks int default 0,
  video_views bigint default 0,
  engagement_rate numeric(5,2) default 0
);

alter table post_analytics enable row level security;

create policy "Users see analytics for their posts"
  on post_analytics for all
  using (
    exists (
      select 1 from post_publications pp
        join posts p on p.id = pp.post_id
        where pp.id = post_analytics.publication_id
          and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from post_publications pp
        join posts p on p.id = pp.post_id
        where pp.id = post_analytics.publication_id
          and p.user_id = auth.uid()
    )
  );

create index post_analytics_publication_id on post_analytics(publication_id);
create index post_analytics_snapshot_at on post_analytics(snapshot_at desc);
