# Critical Bugfixes — Content Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 production-critical bugs: missing user_id on posts, unauthenticated publication route, tokens never refreshed, unauthenticated AI generation routes, and wrong PDF dimensions.

**Architecture:** Each fix is isolated — a migration + schema update, two route rewrites, one adapter helper, and a PDF dimension change. No shared state between tasks. All tasks can be reviewed independently.

**Tech Stack:** Next.js 14 App Router, Supabase (PostgreSQL + RLS + SSR), @supabase/ssr createServerClient, @react-pdf/renderer, TypeScript strict

---

## File Map

| File | Action | Purpose |
|------|---------|---------|
| `supabase/migrations/007_posts_user_id.sql` | CREATE | Adds `user_id` column to `posts` table |
| `supabase/schema.sql` | MODIFY | Sync schema.sql with real DB state |
| `app/api/generate/route.ts` | MODIFY | Add auth guard |
| `app/api/slides/route.ts` | MODIFY | Add auth guard |
| `app/api/publish/route.ts` | MODIFY | Use platform_connections tokens + adapters |
| `app/api/cron/publish-scheduled/route.ts` | MODIFY | Auto-refresh expired tokens before publishing |
| `lib/pdf-render.tsx` | MODIFY | Fix page dimensions 595×595 → 540×675 (4:5 portrait) |
| `app/api/cron/route.ts` | DELETE | Remove legacy cron duplicate |
| `app/api/publish/cron/route.ts` | DELETE | Remove legacy cron duplicate |

---

## Task 1 — Migration: add user_id to posts table

**Files:**
- Create: `supabase/migrations/007_posts_user_id.sql`
- Modify: `supabase/schema.sql`

### Context
`supabase/schema.sql` lines 16-31 define the `posts` table without a `user_id` column. But `supabase/migrations/003_post_publications.sql` creates an RLS policy that does `JOIN posts ON ... WHERE posts.user_id = auth.uid()`, and `app/api/cron/publish-scheduled/route.ts` line 62 queries `platform_connections` by `post.user_id`. Without this column the RLS is silently broken and the cron fails per-post.

- [ ] **Step 1.1: Create the migration file**

```sql
-- supabase/migrations/007_posts_user_id.sql
-- Adds user_id to posts table so RLS in migrations 003 and 005 works correctly.

-- Add user_id column (nullable first so existing rows don't fail)
alter table posts
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Add RLS policies for posts
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

-- Index for cron query pattern: posts by user_id + status
create index if not exists idx_posts_user_id on posts(user_id);
```

- [ ] **Step 1.2: Apply the migration in Supabase**

Go to Supabase → SQL Editor → paste the migration → Run.

Expected: no error. Column `user_id` now exists on `posts`.

- [ ] **Step 1.3: Update schema.sql to reflect reality**

In `supabase/schema.sql`, replace the `posts` table definition (lines 16-31):

Old:
```sql
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
```

New:
```sql
create table posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  topic text,
  description text,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'publishing', 'published', 'failed')),
  platforms text[] not null default '{}',
  content_type text not null default 'carousel',
  payload jsonb,
  scheduled_at timestamptz,
  published_at timestamptz,
  linkedin_post_id text,
  instagram_post_id text,
  pdf_url text,
  slides_urls text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

Also add after the existing index block in schema.sql:
```sql
create index idx_posts_user_id on posts(user_id);

-- RLS
alter table posts enable row level security;
create policy "posts_select_own" on posts for select using (auth.uid() = user_id);
create policy "posts_insert_own" on posts for insert with check (auth.uid() = user_id);
create policy "posts_update_own" on posts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "posts_delete_own" on posts for delete using (auth.uid() = user_id);
```

- [ ] **Step 1.4: Commit**

```bash
git add supabase/migrations/007_posts_user_id.sql supabase/schema.sql
git commit -m "fix(db): add user_id to posts table + RLS policies"
```

---

## Task 2 — Auth guard on /api/generate and /api/slides

**Files:**
- Modify: `app/api/generate/route.ts`
- Modify: `app/api/slides/route.ts`

### Context
Both routes are currently public — zero authentication. Anyone can call `/api/generate` to run 4 parallel Claude API calls (at Anthropic cost), and `/api/slides` to upload PDFs to Supabase Storage (at storage cost). The fix adds a `getUser()` call using `@supabase/ssr` before any work is done.

- [ ] **Step 2.1: Add auth guard to /api/generate**

Replace `app/api/generate/route.ts` entirely:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { generatePostDescription } from '@/lib/claude'
import { generateCarouselSlides } from '@/lib/slides-gen'
import { generateTextPost } from '@/lib/text-post-gen'
import { GenerateBodySchema, parseBody } from '@/lib/zod-schemas'

export async function POST(req: NextRequest) {
  // Auth guard — returns 401 if not logged in
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: () => {}, // read-only in route handler
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  try {
    const parsed = parseBody(GenerateBodySchema, await req.json())
    if (!parsed.success) return parsed.response

    const { topic, title, content_type } = parsed.data
    const effectiveTitle = (title ?? topic).trim()

    if (content_type === 'text') {
      const textPost = await generateTextPost(effectiveTitle, topic.trim())
      return NextResponse.json({ content_type: 'text', ...textPost })
    }

    // carousel (default)
    const [v1, v2, v3, slides] = await Promise.all([
      generatePostDescription(topic.trim(), 'v1'),
      generatePostDescription(topic.trim(), 'v2'),
      generatePostDescription(topic.trim(), 'v3'),
      generateCarouselSlides(effectiveTitle, topic.trim()),
    ])

    return NextResponse.json({ content_type: 'carousel', v1, v2, v3, slides })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[/api/generate] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2.2: Add auth guard to /api/slides**

Replace `app/api/slides/route.ts` entirely:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import React from 'react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { renderToBuffer } from '@react-pdf/renderer'
import { CarouselDocument } from '@/lib/pdf-render'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { SlidesBodySchema, parseBody } from '@/lib/zod-schemas'
import type { Slide } from '@/lib/slides-gen'

export async function POST(req: NextRequest) {
  // Auth guard
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: () => {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  try {
    const parsed = parseBody(SlidesBodySchema, await req.json())
    if (!parsed.success) return parsed.response

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slides = parsed.data.slides as any as Slide[]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(CarouselDocument, { slides }) as any
    const buffer = await renderToBuffer(element)

    const fileName = `${user.id}/${Date.now()}-carousel.pdf`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('carousels')
      .upload(fileName, buffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('carousels')
      .getPublicUrl(fileName)

    return NextResponse.json({ pdfUrl: publicUrl })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

Note: PDFs are now stored under `{user.id}/` prefix for isolation.

- [ ] **Step 2.3: Commit**

```bash
git add app/api/generate/route.ts app/api/slides/route.ts
git commit -m "fix(security): add auth guards to /api/generate and /api/slides"
```

---

## Task 3 — Fix /api/publish to use platform_connections tokens

**Files:**
- Modify: `app/api/publish/route.ts`

### Context
The current route calls `publishLinkedInPost()` and `publishInstagramCarousel()` without passing any token — these functions then fall back to `process.env.LINKEDIN_ACCESS_TOKEN` (a single hardcoded token that won't rotate and isn't per-user). The new flow: auth → load user → for each platform load connection from `platform_connections` → use `getAdapter(platform).publish(content, tokens)`.

- [ ] **Step 3.1: Rewrite /api/publish/route.ts**

Replace `app/api/publish/route.ts` entirely:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdapter } from '@/lib/platforms'
import type { Platform, PostContent, OAuthTokens } from '@/lib/platforms'
import { PublishBodySchema, parseBody } from '@/lib/zod-schemas'

export async function POST(req: NextRequest) {
  // Auth guard
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: () => {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const parsed = parseBody(PublishBodySchema, await req.json())
  if (!parsed.success) return parsed.response

  const { postId } = parsed.data

  // Fetch post — ensure it belongs to this user
  const { data: post, error: postError } = await supabaseAdmin
    .from('posts')
    .select('*')
    .eq('id', postId)
    .eq('user_id', user.id)
    .single()

  if (postError || !post) {
    return NextResponse.json({ error: 'Post introuvable' }, { status: 404 })
  }
  if (post.status === 'published') {
    return NextResponse.json({ error: 'Déjà publié' }, { status: 409 })
  }

  const results: Record<string, string> = {}
  const errors: string[] = []
  const platforms: Platform[] = Array.isArray(post.platforms) ? post.platforms : []

  for (const platform of platforms) {
    // Load tokens from platform_connections
    const { data: connection, error: connError } = await supabaseAdmin
      .from('platform_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', platform)
      .single()

    if (connError || !connection) {
      errors.push(`${platform}: connexion non trouvée — connectez votre compte dans /connections`)
      continue
    }

    const tokens: OAuthTokens = {
      accessToken: connection.access_token,
      refreshToken: connection.refresh_token ?? undefined,
      expiresAt: connection.expires_at ? new Date(connection.expires_at) : undefined,
    }

    const content: PostContent = {
      text: post.description || post.title,
      mediaUrls: post.slides_urls ?? [],
      pdfUrl: post.pdf_url ?? undefined,
      contentType: (post.content_type as PostContent['contentType']) ?? 'carousel',
    }

    try {
      const adapter = getAdapter(platform)
      const result = await adapter.publish(content, tokens)

      if (result.success && result.externalId) {
        results[`${platform}_post_id`] = result.externalId
      } else {
        errors.push(`${platform}: ${result.error ?? 'échec inconnu'}`)
      }
    } catch (e: unknown) {
      errors.push(`${platform}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const hasSuccess = Object.keys(results).length > 0

  const { error: updateError } = await supabaseAdmin
    .from('posts')
    .update({
      ...results,
      status: hasSuccess ? 'published' : 'failed',
      published_at: hasSuccess ? new Date().toISOString() : null,
    })
    .eq('id', postId)

  if (updateError) {
    console.error('[/api/publish] Failed to update post status:', updateError.message)
    return NextResponse.json(
      { error: 'Publication réussie mais mise à jour du statut échouée' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: hasSuccess, results, errors })
}
```

- [ ] **Step 3.2: Commit**

```bash
git add app/api/publish/route.ts
git commit -m "fix(publish): use platform_connections tokens instead of global env vars"
```

---

## Task 4 — Auto-refresh expired tokens in publish-scheduled cron

**Files:**
- Modify: `app/api/cron/publish-scheduled/route.ts`

### Context
The cron loads tokens from `platform_connections` but never checks if they're expired. LinkedIn tokens expire after 60 days, Meta tokens after 60 days, X tokens after 2 hours. The fix: after loading `connection`, if `expires_at < now + 5 minutes`, call `adapter.refreshToken(tokens)`, update `platform_connections` with the new tokens, then continue with the fresh token.

- [ ] **Step 4.1: Add `shouldRefresh` helper and token refresh logic**

In `app/api/cron/publish-scheduled/route.ts`, find the block that starts at:
```typescript
      const tokens: OAuthTokens = {
        accessToken: connection.access_token,
        refreshToken: connection.refresh_token ?? undefined,
        expiresAt: connection.expires_at ? new Date(connection.expires_at) : undefined,
        scopes: connection.scopes ?? undefined,
      }
```

Replace that block (everything from `const tokens: OAuthTokens` up to but NOT including `try {`) with:

```typescript
      let tokens: OAuthTokens = {
        accessToken: connection.access_token,
        refreshToken: connection.refresh_token ?? undefined,
        expiresAt: connection.expires_at ? new Date(connection.expires_at) : undefined,
        scopes: connection.scopes ?? undefined,
      }

      // Auto-refresh if token expires within 10 minutes
      const REFRESH_THRESHOLD_MS = 10 * 60 * 1000
      const isExpiringSoon =
        tokens.expiresAt &&
        tokens.expiresAt.getTime() - Date.now() < REFRESH_THRESHOLD_MS

      if (isExpiringSoon && tokens.refreshToken) {
        try {
          const adapter = getAdapter(platform)
          const refreshed = await adapter.refreshToken(tokens)
          tokens = refreshed

          // Persist refreshed tokens to DB
          await supabaseAdmin
            .from('platform_connections')
            .update({
              access_token: refreshed.accessToken,
              refresh_token: refreshed.refreshToken ?? connection.refresh_token,
              expires_at: refreshed.expiresAt?.toISOString() ?? null,
            })
            .eq('id', connection.id)

          console.log(`[publish-scheduled] refreshed token for ${platform} / user ${post.user_id}`)
        } catch (refreshErr: unknown) {
          const msg = refreshErr instanceof Error ? refreshErr.message : String(refreshErr)
          console.error(`[publish-scheduled] token refresh failed for ${platform}:`, msg)
          // Continue with existing token — it may still work if not fully expired
        }
      }
```

- [ ] **Step 4.2: Commit**

```bash
git add app/api/cron/publish-scheduled/route.ts
git commit -m "fix(cron): auto-refresh expired OAuth tokens before publishing"
```

---

## Task 5 — Fix PDF dimensions to portrait 4:5

**Files:**
- Modify: `lib/pdf-render.tsx`

### Context
Every `<Page>` in `lib/pdf-render.tsx` uses `size={[595, 595]}` (square) and `style={S.page}` where `S.page` has `width: 595, height: 595`. LinkedIn document carousels display best in portrait format (4:5 ratio = 1200×1500px). The fix changes all pages to `540×675` pts (4:5 ratio) and adjusts the `S.page` style. At 72dpi these are 7.5"×9.375" — LinkedIn will display them at full portrait. No layout reflow needed since react-pdf scales content proportionally.

- [ ] **Step 5.1: Update S.page style**

In `lib/pdf-render.tsx` line 31, replace:
```typescript
    width: 595, height: 595,
```
With:
```typescript
    width: 540, height: 675,
```

- [ ] **Step 5.2: Update all Page size props**

There are 7 `<Page size={[595, 595]}>` calls (lines 203, 230, 257, 273, 295, 321, 345). Replace all 7:

Old: `<Page size={[595, 595]}` 
New: `<Page size={[540, 675]}`

Use search-and-replace: in `lib/pdf-render.tsx`, replace ALL occurrences of `[595, 595]` with `[540, 675]`.

- [ ] **Step 5.3: Commit**

```bash
git add lib/pdf-render.tsx
git commit -m "fix(pdf): change page dimensions from square 595x595 to portrait 540x675 (4:5 ratio)"
```

---

## Task 6 — Delete legacy cron duplicates

**Files:**
- Delete: `app/api/cron/route.ts`
- Delete: `app/api/publish/cron/route.ts`

### Context
These two files are duplicate implementations of the publish cron that use global env tokens (no per-user tokens), are not registered in `vercel.json`, and can cause accidental re-publications if someone discovers their URL and calls them with the `CRON_SECRET`. The only valid publish cron is `app/api/cron/publish-scheduled/route.ts`.

- [ ] **Step 6.1: Delete both files**

```bash
git rm app/api/cron/route.ts app/api/publish/cron/route.ts
```

- [ ] **Step 6.2: Commit**

```bash
git commit -m "fix(cron): remove legacy duplicate cron files (used global env tokens)"
```

---

## Task 7 — Push and deploy

- [ ] **Step 7.1: Final check — no TypeScript regressions**

```bash
cd C:/Users/ethaa/0flaw-content-hub
npx tsc --noEmit 2>&1 | grep -v "Cannot find module" | grep -v "no-explicit-any"
```

Expected: only the pre-existing "Cannot find module" errors for packages like `@anthropic-ai/sdk` (installed on server, not locally). No new errors.

- [ ] **Step 7.2: Push to main**

```bash
git push origin main
```

Vercel auto-deploys. Watch deploy status at vercel.com → your project → Deployments.

- [ ] **Step 7.3: Apply migration 007 in Supabase**

Go to Supabase → SQL Editor → paste contents of `supabase/migrations/007_posts_user_id.sql` → Run.

Expected: `ALTER TABLE` success, no errors.

---

## Self-review checklist

- [x] **Spec coverage:** All 5 bugs have dedicated tasks. Legacy cron deletion added as Task 6 (was identified in audit as blocking security issue).
- [x] **No placeholders:** All code blocks are complete and copy-pasteable.
- [x] **Type consistency:** `OAuthTokens`, `PostContent`, `Platform`, `getAdapter` all imported from `@/lib/platforms` consistently across Task 3 and Task 4.
- [x] **Migration is idempotent:** Uses `add column if not exists` and `drop policy if exists` — safe to re-run.
- [x] **Auth pattern consistent:** All new route handlers use the same `createServerClient` + `getAll: () => req.cookies.getAll()` + `setAll: () => {}` pattern as existing OAuth callbacks.
