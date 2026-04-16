-- supabase/migrations/004_newsletter.sql

create table if not exists newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  first_name text,
  company text,
  segment text check (segment in ('prospect', 'client', 'partner')),
  consent_given_at timestamptz not null,
  consent_ip text,
  confirm_token text,
  confirm_token_expires_at timestamptz,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  brevo_contact_id bigint,
  created_at timestamptz default now()
);

create table if not exists newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  preheader text,
  mjml_source text,
  html_rendered text,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sent')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  brevo_campaign_id bigint,
  stats jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table newsletter_subscribers enable row level security;
alter table newsletter_campaigns enable row level security;

-- Subscribers: only service role can read (RGPD) — no policy for authenticated users
-- Campaigns: authenticated users can manage
create policy "Authenticated users manage campaigns"
  on newsletter_campaigns for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create index newsletter_subscribers_email on newsletter_subscribers(email);
create index newsletter_subscribers_confirmed on newsletter_subscribers(confirmed_at) where confirmed_at is not null;
create index newsletter_campaigns_status on newsletter_campaigns(status);
