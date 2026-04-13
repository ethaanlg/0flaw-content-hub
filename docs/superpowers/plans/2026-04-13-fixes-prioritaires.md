# Fixes Prioritaires — 0Flaw Content Hub

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger les 9 problèmes identifiés (sécurité, robustesse, maintenabilité) en ordre de priorité sans casser l'existant.

**Architecture:** Chaque tâche est indépendante sauf Task 5 (Settings Supabase) qui dépend de Task 4 (Auth). Ordre : types → Zod → error boundaries → auth+RLS → settings → retry → pagination → Sentry → cache Claude.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Supabase JS v2, Zod, React Error Boundary, Sentry Next.js SDK, Vercel KV

---

## Fichiers créés / modifiés

| Fichier | Action | Responsabilité |
|---|---|---|
| `lib/types.ts` | Créer | Source unique des types Post, PostStats, Settings, Slide |
| `lib/supabase.ts` | Modifier | Retirer les types (→ lib/types.ts), adapter client auth |
| `lib/zod-schemas.ts` | Créer | Schémas Zod pour chaque POST body API |
| `lib/retry.ts` | Créer | Utilitaire withRetry() avec exponential backoff |
| `lib/linkedin.ts` | Modifier | Enrober les fetch avec withRetry() |
| `lib/instagram.ts` | Modifier | Enrober les fetch avec withRetry() |
| `app/api/generate/route.ts` | Modifier | Valider avec Zod |
| `app/api/publish/route.ts` | Modifier | Valider avec Zod |
| `app/api/posts/route.ts` | Modifier | Valider avec Zod + pagination cursor |
| `app/api/stats/route.ts` | Modifier | Valider avec Zod + pagination |
| `app/api/slides/route.ts` | Modifier | Valider avec Zod |
| `app/api/auth/callback/route.ts` | Créer | Callback OAuth Supabase |
| `app/login/page.tsx` | Créer | Page de login (magic link + Google) |
| `app/layout.tsx` | Modifier | Ajouter AuthGuard + ErrorBoundary |
| `components/AuthGuard.tsx` | Créer | Redirect vers /login si non auth |
| `components/GlobalErrorBoundary.tsx` | Créer | React Error Boundary global |
| `app/settings/page.tsx` | Modifier | Lire/écrire settings depuis Supabase au lieu de localStorage |
| `supabase-schema.sql` | Modifier | Ajouter user_id FK, RLS stricte, table user_settings |
| `middleware.ts` | Créer | Supabase Auth session middleware Next.js |
| `sentry.client.config.ts` | Créer | Config Sentry côté client |
| `sentry.server.config.ts` | Créer | Config Sentry côté serveur |
| `next.config.js` | Modifier | Wrapper withSentryConfig |
| `lib/claude.ts` | Modifier | Cache Vercel KV sur generatePostDescription() |

---

## Task 1 — Centralisation des types

**Problème :** Le type `Post` est défini dans `lib/supabase.ts` et potentiellement redéfini inline dans plusieurs pages. Source de drift entre fichiers.

**Files:**
- Create: `lib/types.ts`
- Modify: `lib/supabase.ts` (lignes 9-39 : supprimer les types, importer depuis lib/types.ts)

- [ ] **Step 1.1 : Créer lib/types.ts**

```typescript
// lib/types.ts
export type Post = {
  id: string
  title: string
  topic: string | null
  description: string | null
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  platforms: string[]
  scheduled_at: string | null
  published_at: string | null
  linkedin_post_id: string | null
  instagram_post_id: string | null
  pdf_url: string | null
  slides_urls: string[] | null
  created_at: string
  updated_at: string
}

export type PostStats = {
  id: string
  post_id: string
  platform: 'linkedin' | 'instagram'
  collected_at: string
  impressions: number
  reach: number
  likes: number
  comments: number
  shares: number
  saves: number
  clicks: number
  engagement_rate: number
}

export type Settings = {
  weekGoal: number
  optimalDays: number[]
  optimalHour: number
  defaultPlatforms: string[]
  aiModel: string
  linkedinConnected: boolean
  instagramConnected: boolean
}
```

- [ ] **Step 1.2 : Modifier lib/supabase.ts pour importer depuis lib/types.ts**

Remplacer le contenu complet de `lib/supabase.ts` par :

```typescript
import { createClient } from '@supabase/supabase-js'

// Public client — safe to import in client components
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type { Post, PostStats, Settings } from './types'
```

- [ ] **Step 1.3 : Vérifier les imports dans les pages qui importent Post/PostStats depuis lib/supabase**

Chercher tous les fichiers qui font `import { Post` ou `import type { Post` depuis `@/lib/supabase` — ils continueront de fonctionner via le re-export. Vérifier qu'aucune page ne redéfinit `Post` localement avec `type Post = {`.

```bash
grep -r "type Post" /c/Users/ethaa/0flaw-content-hub/app --include="*.tsx" --include="*.ts" -l
```

Si des fichiers ont leur propre `type Post = {`, supprimer la définition locale et ajouter l'import :
```typescript
import type { Post } from '@/lib/types'
```

- [ ] **Step 1.4 : Build de vérification**

```bash
cd /c/Users/ethaa/0flaw-content-hub && npm run build 2>&1 | tail -20
```

Attendu : aucune erreur TypeScript, build réussi.

- [ ] **Step 1.5 : Commit**

```bash
cd /c/Users/ethaa/0flaw-content-hub
git add lib/types.ts lib/supabase.ts
git commit -m "refactor: centralise Post/PostStats/Settings types dans lib/types.ts"
```

---

## Task 2 — Validation des inputs API avec Zod

**Problème :** Les POST bodies des routes API ne sont pas validés. `const { topic } = await req.json()` sans schema = crash ou injection possible si le payload est malformé.

**Files:**
- Create: `lib/zod-schemas.ts`
- Modify: `app/api/generate/route.ts`
- Modify: `app/api/publish/route.ts`
- Modify: `app/api/posts/route.ts`
- Modify: `app/api/stats/route.ts`
- Modify: `app/api/slides/route.ts`

- [ ] **Step 2.1 : Installer Zod**

```bash
cd /c/Users/ethaa/0flaw-content-hub && npm install zod
```

Attendu : `zod` ajouté dans `node_modules`, package.json mis à jour.

- [ ] **Step 2.2 : Créer lib/zod-schemas.ts**

```typescript
// lib/zod-schemas.ts
import { z } from 'zod'

export const GenerateBodySchema = z.object({
  topic: z.string().min(3, 'Sujet trop court (min 3 caractères)').max(200),
  title: z.string().max(200).optional(),
})

export const PublishBodySchema = z.object({
  postId: z.string().uuid('postId doit être un UUID valide'),
})

export const SlidesBodySchema = z.object({
  slides: z.array(z.object({
    type: z.string(),
    tag: z.string().optional(),
    title: z.string().optional(),
    body: z.string().optional(),
    bullets: z.array(z.string()).optional(),
    label: z.string().optional(),
    value: z.string().optional(),
    caption: z.string().optional(),
  })).min(1, 'Au moins un slide requis'),
})

export const PostsUpdateBodySchema = z.object({
  id: z.string().uuid('id doit être un UUID valide'),
  status: z.enum(['draft', 'scheduled', 'published', 'failed']).optional(),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
})

export const StatsBodySchema = z.object({
  postId: z.string().uuid('postId doit être un UUID valide'),
})
```

- [ ] **Step 2.3 : Créer un helper de validation réutilisable dans lib/zod-schemas.ts**

Ajouter à la fin de `lib/zod-schemas.ts` :

```typescript
import { NextResponse } from 'next/server'
import type { ZodSchema } from 'zod'

export function parseBody<T>(schema: ZodSchema<T>, data: unknown):
  | { success: true; data: T }
  | { success: false; response: NextResponse } {
  const result = schema.safeParse(data)
  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      ),
    }
  }
  return { success: true, data: result.data }
}
```

- [ ] **Step 2.4 : Modifier app/api/generate/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { generatePostDescription } from '@/lib/claude'
import { generateCarouselSlides } from '@/lib/slides-gen'
import { GenerateBodySchema, parseBody } from '@/lib/zod-schemas'

export async function POST(req: NextRequest) {
  try {
    const parsed = parseBody(GenerateBodySchema, await req.json())
    if (!parsed.success) return parsed.response

    const { topic, title } = parsed.data
    const effectiveTitle = (title ?? topic).trim()

    const [v1, v2, v3, slides] = await Promise.all([
      generatePostDescription(topic.trim(), 'v1'),
      generatePostDescription(topic.trim(), 'v2'),
      generatePostDescription(topic.trim(), 'v3'),
      generateCarouselSlides(effectiveTitle, topic.trim()),
    ])

    return NextResponse.json({ v1, v2, v3, slides })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[/api/generate] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2.5 : Modifier app/api/publish/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { publishLinkedInPost } from '@/lib/linkedin'
import { publishInstagramCarousel } from '@/lib/instagram'
import { PublishBodySchema, parseBody } from '@/lib/zod-schemas'

export async function POST(req: NextRequest) {
  try {
    const parsed = parseBody(PublishBodySchema, await req.json())
    if (!parsed.success) return parsed.response

    const { postId } = parsed.data

    const { data: post, error } = await supabaseAdmin
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single()

    if (error || !post) return NextResponse.json({ error: 'Post introuvable' }, { status: 404 })
    if (post.status === 'published') return NextResponse.json({ error: 'Déjà publié' }, { status: 409 })

    const results: Record<string, string> = {}
    const errors: string[] = []

    if (post.platforms.includes('linkedin') && post.pdf_url) {
      try {
        const liPostId = await publishLinkedInPost(
          post.description || post.title,
          post.pdf_url,
          post.title
        )
        results.linkedin_post_id = liPostId
      } catch (e: unknown) {
        errors.push(`LinkedIn: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    if (post.platforms.includes('instagram') && post.slides_urls?.length) {
      try {
        const igPostId = await publishInstagramCarousel(
          post.description || post.title,
          post.slides_urls
        )
        results.instagram_post_id = igPostId
      } catch (e: unknown) {
        errors.push(`Instagram: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    const hasSuccess = Object.keys(results).length > 0
    await supabaseAdmin.from('posts').update({
      ...results,
      status: hasSuccess ? 'published' : 'failed',
      published_at: hasSuccess ? new Date().toISOString() : null
    }).eq('id', postId)

    return NextResponse.json({ success: hasSuccess, results, errors })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2.6 : Modifier app/api/posts/route.ts (POST handler uniquement)**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { PostsUpdateBodySchema, parseBody } from '@/lib/zod-schemas'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const status = searchParams.get('status')
  const platform = searchParams.get('platform')

  let query = supabaseAdmin
    .from('posts')
    .select('*')
    .order('scheduled_at', { ascending: true })

  if (from) query = query.gte('scheduled_at', from)
  if (to) query = query.lte('scheduled_at', to)
  if (status) query = query.eq('status', status)
  if (platform) query = query.contains('platforms', [platform])

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data })
}

export async function POST(req: NextRequest) {
  try {
    const parsed = parseBody(PostsUpdateBodySchema, await req.json())
    if (!parsed.success) return parsed.response

    const { id, status, scheduledAt } = parsed.data
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (status !== undefined) updates.status = status

    if (scheduledAt !== undefined) {
      updates.scheduled_at = scheduledAt ? new Date(scheduledAt).toISOString() : null
      if (scheduledAt && !updates.status) updates.status = 'scheduled'
    }

    const { data, error } = await supabaseAdmin
      .from('posts')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ post: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2.7 : Modifier app/api/stats/route.ts (POST handler uniquement)**

Dans `app/api/stats/route.ts`, remplacer le début du handler POST :

```typescript
import { StatsBodySchema, parseBody } from '@/lib/zod-schemas'

export async function POST(req: NextRequest) {
  try {
    const parsed = parseBody(StatsBodySchema, await req.json())
    if (!parsed.success) return parsed.response

    const { postId } = parsed.data
    // ... reste du handler identique
```

- [ ] **Step 2.8 : Modifier app/api/slides/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { CarouselDocument } from '@/lib/pdf-render'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { SlidesBodySchema, parseBody } from '@/lib/zod-schemas'
import type { Slide } from '@/lib/slides-gen'

export async function POST(req: NextRequest) {
  try {
    const parsed = parseBody(SlidesBodySchema, await req.json())
    if (!parsed.success) return parsed.response

    const slides = parsed.data.slides as Slide[]

    const element = React.createElement(CarouselDocument, { slides }) as React.ReactElement
    const buffer = await renderToBuffer(element)

    const fileName = `${Date.now()}-carousel.pdf`
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

- [ ] **Step 2.9 : Build de vérification**

```bash
cd /c/Users/ethaa/0flaw-content-hub && npm run build 2>&1 | tail -20
```

Attendu : aucune erreur TypeScript, build réussi.

- [ ] **Step 2.10 : Commit**

```bash
cd /c/Users/ethaa/0flaw-content-hub
git add lib/zod-schemas.ts app/api/generate/route.ts app/api/publish/route.ts app/api/posts/route.ts app/api/stats/route.ts app/api/slides/route.ts
git commit -m "feat: validation Zod sur tous les POST bodies des routes API"
```

---

## Task 3 — Error Boundary global React

**Problème :** Une erreur JavaScript dans un composant React (ex: crash pendant rendu analytics) provoque un écran blanc sans message d'erreur. React Error Boundaries interceptent et affichent un fallback.

**Files:**
- Create: `components/GlobalErrorBoundary.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 3.1 : Créer components/GlobalErrorBoundary.tsx**

```tsx
'use client'

import React from 'react'

type Props = { children: React.ReactNode }
type State = { hasError: boolean; message: string }

export class GlobalErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[GlobalErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: 16,
          padding: 32,
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 40,
            fontFamily: 'Syne, sans-serif',
            fontWeight: 800,
            color: 'var(--red, #ff4f6f)',
          }}>
            Erreur
          </div>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', maxWidth: 480 }}>
            Une erreur inattendue s&apos;est produite. Rechargez la page ou contactez le support.
          </p>
          {this.state.message && (
            <code style={{
              fontSize: 11,
              background: 'rgba(255,255,255,0.05)',
              padding: '8px 14px',
              borderRadius: 8,
              color: 'rgba(255,255,255,0.3)',
              maxWidth: 600,
              wordBreak: 'break-all',
            }}>
              {this.state.message}
            </code>
          )}
          <button
            className="btn btn-ghost"
            onClick={() => this.setState({ hasError: false, message: '' })}
            style={{ marginTop: 8 }}
          >
            Réessayer
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
```

- [ ] **Step 3.2 : Modifier app/layout.tsx pour enrober le contenu**

```tsx
import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary'

export const metadata: Metadata = {
  title: '0Flaw Content Hub',
  description: 'Gestion de contenu LinkedIn & Instagram pour 0Flaw',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <main style={{
          flex: 1,
          marginLeft: 'var(--sidebar-w)',
          padding: '32px',
          position: 'relative',
          zIndex: 1,
          transition: 'margin-left 0.25s ease',
          minWidth: 0,
        }}>
          <GlobalErrorBoundary>
            {children}
          </GlobalErrorBoundary>
        </main>
      </body>
    </html>
  )
}
```

- [ ] **Step 3.3 : Build de vérification**

```bash
cd /c/Users/ethaa/0flaw-content-hub && npm run build 2>&1 | tail -20
```

Attendu : build réussi, aucune erreur TypeScript.

- [ ] **Step 3.4 : Commit**

```bash
cd /c/Users/ethaa/0flaw-content-hub
git add components/GlobalErrorBoundary.tsx app/layout.tsx
git commit -m "feat: ajoute GlobalErrorBoundary pour éviter les écrans blancs"
```

---

## Task 4 — Authentification Supabase + RLS multi-tenant

**Problème :** L'application est entièrement publique. Toute personne avec l'URL peut lire et modifier tous les posts. Il faut :
1. Ajouter Supabase Auth (magic link email)
2. Ajouter `user_id` sur les tables `posts` et `post_stats`
3. Remplacer les RLS "Allow all" par des policies user-scoped
4. Protéger toutes les pages avec un middleware Next.js
5. Créer une page `/login`

**Files:**
- Create: `middleware.ts`
- Create: `app/login/page.tsx`
- Create: `app/api/auth/callback/route.ts`
- Create: `components/AuthGuard.tsx` (hook client-side)
- Modify: `lib/supabase.ts` (client avec auth session)
- Modify: `app/layout.tsx`
- Modify: `supabase-schema.sql`

### 4A — Mise à jour du schéma Supabase

- [ ] **Step 4.1 : Exécuter ce SQL dans l'éditeur Supabase**

Se connecter au tableau de bord Supabase > SQL Editor et exécuter :

```sql
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
```

Attendu : "Success. No rows returned."

- [ ] **Step 4.2 : Mettre à jour supabase-schema.sql pour refléter les changements**

Ajouter à la fin du fichier `supabase-schema.sql` le bloc SQL ci-dessus (Step 4.1) précédé du commentaire :

```sql
-- ============================================================
-- Migration 2026-04-13 : Auth multi-tenant + user_settings
-- ============================================================
```

### 4B — Middleware Next.js

- [ ] **Step 4.3 : Installer @supabase/ssr**

```bash
cd /c/Users/ethaa/0flaw-content-hub && npm install @supabase/ssr
```

Attendu : package installé.

- [ ] **Step 4.4 : Créer middleware.ts à la racine du projet**

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/auth']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Laisser passer les routes publiques et API internes
  if (
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies) => cookies.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options)
        ),
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

### 4C — Callback OAuth

- [ ] **Step 4.5 : Créer app/api/auth/callback/route.ts**

```typescript
// app/api/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const redirectTo = searchParams.get('redirectTo') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (newCookies) => newCookies.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
        },
      }
    )
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL(redirectTo, req.url))
}
```

### 4D — Page Login

- [ ] **Step 4.6 : Créer app/login/page.tsx**

```tsx
// app/login/page.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f1225',
      padding: 24,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        padding: '40px 32px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
      }}>
        <h1 style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 800,
          fontSize: 28,
          marginBottom: 8,
          color: '#fff',
        }}>
          0Flaw Content Hub
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 32 }}>
          Connecte-toi pour accéder à ton espace.
        </p>

        {sent ? (
          <div style={{
            padding: '16px 20px',
            background: 'rgba(61,255,160,0.08)',
            border: '1px solid rgba(61,255,160,0.25)',
            borderRadius: 12,
            fontSize: 13,
            color: 'var(--green, #3dffa0)',
            lineHeight: 1.6,
          }}>
            Email envoyé à <strong>{email}</strong>. Clique sur le lien pour te connecter.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6 }}>
                Adresse email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ton@email.com"
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
              <div style={{ fontSize: 12, color: 'var(--red, #ff4f6f)', padding: '8px 12px', background: 'rgba(255,79,111,0.08)', borderRadius: 8 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !email}
              style={{ marginTop: 4 }}
            >
              {loading ? 'Envoi...' : 'Recevoir le lien de connexion'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
```

### 4E — Adapter les API routes pour propager user_id

- [ ] **Step 4.7 : Modifier app/api/posts/route.ts — ajouter user_id à l'insert**

Le POST existant met à jour un post (pas d'insert). L'insert de nouveau post se fait depuis la page `create`. Il faut trouver où le post est inséré initialement et y ajouter `user_id`.

Chercher l'appel insert dans app/create :

```bash
grep -n "supabase" /c/Users/ethaa/0flaw-content-hub/app/create/page.tsx | head -20
```

Dans la page create, lors du `supabase.from('posts').insert({...})`, ajouter `user_id` :

```typescript
// Récupérer le user courant côté client
const { data: { user } } = await supabase.auth.getUser()

await supabase.from('posts').insert({
  ...postData,
  user_id: user?.id,  // ← ajouter cette ligne
})
```

**Note :** Lire la page create complète pour trouver le bon endroit avant de modifier.

- [ ] **Step 4.8 : Modifier lib/supabase-admin.ts pour noter l'usage restreint**

Les routes API qui utilisent `supabaseAdmin` (service role) bypassent RLS — c'est intentionnel pour le cron. S'assurer que le cron (`/api/cron/route.ts`) filtre par user si nécessaire. Pour un usage mono-utilisateur actuel (Ethan), le cron peut rester sans filtre user_id. Documenter :

```typescript
// lib/supabase-admin.ts
import { createClient } from '@supabase/supabase-js'

// Admin client — server-side only (API routes, Server Components)
// Bypasses RLS — utiliser uniquement dans les cron jobs et routes admin.
// JAMAIS importer dans les client components ou routes accessibles publiquement.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

- [ ] **Step 4.9 : Build de vérification**

```bash
cd /c/Users/ethaa/0flaw-content-hub && npm run build 2>&1 | tail -30
```

Attendu : build réussi. Si erreur sur `cookies()`, vérifier que `app/api/auth/callback/route.ts` utilise bien `await cookies()` (Next.js 15 API).

- [ ] **Step 4.10 : Test manuel**

1. Lancer `npm run dev`
2. Ouvrir `http://localhost:3000` → redirection vers `/login` attendue
3. Entrer son email → email reçu avec lien
4. Cliquer lien → redirection vers `/dashboard` attendue
5. L'application fonctionne normalement

- [ ] **Step 4.11 : Commit**

```bash
cd /c/Users/ethaa/0flaw-content-hub
git add middleware.ts app/login/page.tsx app/api/auth/callback/route.ts lib/supabase-admin.ts supabase-schema.sql
git commit -m "feat: auth Supabase magic link + middleware protection + RLS multi-tenant"
```

---

## Task 5 — Settings persistés dans Supabase

**Problème :** Les préférences (jours optimaux, objectif hebdo) sont dans `localStorage`. Elles se perdent si on change de navigateur/appareil.

**Dépendance :** Task 4 doit être complète (user_id disponible, table `user_settings` créée).

**Files:**
- Modify: `app/settings/page.tsx`

- [ ] **Step 5.1 : Modifier app/settings/page.tsx — charger depuis Supabase**

Remplacer les fonctions `useEffect` (chargement localStorage) et `save()` par des appels Supabase :

```tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Settings } from '@/lib/types'

// ... (garder Toast, Section, Row, Toggle, PlatformStatus identiques)

const DEFAULT: Settings = {
  weekGoal: 2,
  optimalDays: [2, 4],
  optimalHour: 8,
  defaultPlatforms: ['linkedin', 'instagram'],
  aiModel: 'claude-sonnet-4-6',
  linkedinConnected: false,
  instagramConnected: false,
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT)
  const [toast, setToast] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  // Charger depuis Supabase au mount
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data) {
        setSettings({
          weekGoal: data.week_goal,
          optimalDays: data.optimal_days,
          optimalHour: data.optimal_hour,
          defaultPlatforms: data.default_platforms,
          aiModel: data.ai_model,
          linkedinConnected: data.linkedin_connected,
          instagramConnected: data.instagram_connected,
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function toggleDay(day: number) {
    const days = settings.optimalDays.includes(day)
      ? settings.optimalDays.filter(d => d !== day)
      : [...settings.optimalDays, day]
    update('optimalDays', days)
  }

  function togglePlatform(p: string) {
    const plats = settings.defaultPlatforms.includes(p)
      ? settings.defaultPlatforms.filter(x => x !== p)
      : [...settings.defaultPlatforms, p]
    update('defaultPlatforms', plats)
  }

  async function save() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('user_settings').upsert({
      user_id: user.id,
      week_goal: settings.weekGoal,
      optimal_days: settings.optimalDays,
      optimal_hour: settings.optimalHour,
      default_platforms: settings.defaultPlatforms,
      ai_model: settings.aiModel,
      linkedin_connected: settings.linkedinConnected,
      instagram_connected: settings.instagramConnected,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    setSaved(true)
    setToast(true)
    setTimeout(() => setToast(false), 2500)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Chargement...</div>
    </div>
  )

  // ... (reste du JSX identique, garder le même return)
```

- [ ] **Step 5.2 : Supprimer la référence à localStorage dans la Danger Zone**

Dans le handler de reset (bouton "Réinitialiser") :

```typescript
// Remplacer :
localStorage.removeItem(STORAGE_KEY)

// Par (supprimer en Supabase) :
const { data: { user } } = await supabase.auth.getUser()
if (user) {
  await supabase.from('user_settings').delete().eq('user_id', user.id)
}
```

Faire du handler `onClick` une fonction `async`.

- [ ] **Step 5.3 : Build de vérification**

```bash
cd /c/Users/ethaa/0flaw-content-hub && npm run build 2>&1 | tail -20
```

Attendu : build réussi.

- [ ] **Step 5.4 : Test manuel**

1. Modifier l'objectif hebdomadaire → sauvegarder
2. Ouvrir un onglet navigation privée → se connecter avec le même email
3. Aller sur `/settings` → les valeurs doivent être identiques à celles sauvegardées

- [ ] **Step 5.5 : Commit**

```bash
cd /c/Users/ethaa/0flaw-content-hub
git add app/settings/page.tsx
git commit -m "feat: settings persistés dans Supabase au lieu de localStorage"
```

---

## Task 6 — Retry logic sur les APIs externes

**Problème :** Un timeout LinkedIn ou Instagram marque immédiatement le post comme `failed` sans réessai. Un réseau instable ou une latence API momentanée tue la publication.

**Files:**
- Create: `lib/retry.ts`
- Modify: `lib/linkedin.ts`
- Modify: `lib/instagram.ts`

- [ ] **Step 6.1 : Créer lib/retry.ts**

```typescript
// lib/retry.ts

/**
 * Exécute fn avec jusqu'à maxAttempts tentatives.
 * Délai exponentiel : baseDelayMs * 2^attempt + jitter.
 * Ne retente que les erreurs non-4xx (erreurs réseau/serveur).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 500, label = 'operation' } = options

  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      lastError = err
      // Ne pas retenter les erreurs métier (HTTP 4xx)
      if (err instanceof Error && err.message.match(/\b(400|401|403|404|409|422)\b/)) {
        throw err
      }
      if (attempt < maxAttempts - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 100
        console.warn(`[retry] ${label} — tentative ${attempt + 1}/${maxAttempts} échouée, retry dans ${Math.round(delay)}ms`, err)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}
```

- [ ] **Step 6.2 : Modifier lib/linkedin.ts — enrober avec withRetry**

```typescript
// lib/linkedin.ts
import { withRetry } from './retry'

// ... (garder LI_BASE, ORG_ID, TOKEN, headers() identiques)

export async function publishLinkedInPost(
  text: string,
  pdfUrl: string,
  pdfTitle: string
): Promise<string> {
  return withRetry(async () => {
    // Étape 1 : initialiser l'upload du document
    const initRes = await fetch(`${LI_BASE}/assets?action=registerUpload`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-document'],
          owner: `urn:li:organization:${ORG_ID}`,
          serviceRelationships: [{
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent'
          }]
        }
      })
    })
    const initData = await initRes.json()
    if (!initRes.ok) {
      throw new Error(`LinkedIn registerUpload ${initRes.status}: ${JSON.stringify(initData)}`)
    }
    const uploadUrl = initData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl
    const asset = initData.value.asset

    // Étape 2 : uploader le PDF
    const pdfBuffer = await fetch(pdfUrl).then(r => r.arrayBuffer())
    await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: pdfBuffer
    })

    // Étape 3 : créer le post
    const postRes = await fetch(`${LI_BASE}/ugcPosts`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        author: `urn:li:organization:${ORG_ID}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text },
            shareMediaCategory: 'DOCUMENT',
            media: [{
              status: 'READY',
              description: { text: pdfTitle },
              media: asset,
              title: { text: pdfTitle }
            }]
          }
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
      })
    })

    const postData = await postRes.json()
    if (!postRes.ok) {
      throw new Error(`LinkedIn ugcPosts ${postRes.status}: ${JSON.stringify(postData)}`)
    }
    return postData.id
  }, { maxAttempts: 3, baseDelayMs: 1000, label: 'publishLinkedInPost' })
}

export async function getLinkedInPostStats(postId: string) {
  return withRetry(async () => {
    const encodedId = encodeURIComponent(postId)
    const res = await fetch(
      `${LI_BASE}/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${ORG_ID}&ugcPosts=List(${encodedId})`,
      { headers: headers() }
    )
    const data = await res.json()
    const stats = data.elements?.[0]?.totalShareStatistics || {}
    return {
      impressions: stats.impressionCount || 0,
      reach: stats.uniqueImpressionsCount || 0,
      likes: stats.likeCount || 0,
      comments: stats.commentCount || 0,
      shares: stats.shareCount || 0,
      clicks: stats.clickCount || 0,
      engagement_rate: stats.impressionCount
        ? parseFloat((((stats.likeCount + stats.commentCount + stats.shareCount) / stats.impressionCount) * 100).toFixed(2))
        : 0
    }
  }, { maxAttempts: 3, baseDelayMs: 500, label: 'getLinkedInPostStats' })
}
```

- [ ] **Step 6.3 : Modifier lib/instagram.ts — enrober avec withRetry**

```typescript
// lib/instagram.ts
import { withRetry } from './retry'

// ... (garder META_BASE, IG_ID, TOKEN identiques)

export async function publishInstagramCarousel(
  caption: string,
  imageUrls: string[]
): Promise<string> {
  return withRetry(async () => {
    const childIds: string[] = []
    for (const imageUrl of imageUrls) {
      const res = await fetch(
        `${META_BASE}/${IG_ID}/media?image_url=${encodeURIComponent(imageUrl)}&is_carousel_item=true&access_token=${TOKEN}`,
        { method: 'POST' }
      )
      const data = await res.json()
      if (!data.id) throw new Error(`Erreur création slide: ${JSON.stringify(data)}`)
      childIds.push(data.id)
    }

    const carouselRes = await fetch(`${META_BASE}/${IG_ID}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'CAROUSEL',
        children: childIds,
        caption,
        access_token: TOKEN
      })
    })
    const carouselData = await carouselRes.json()
    if (!carouselData.id) throw new Error(`Erreur container carrousel: ${JSON.stringify(carouselData)}`)

    const publishRes = await fetch(`${META_BASE}/${IG_ID}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: carouselData.id,
        access_token: TOKEN
      })
    })
    const publishData = await publishRes.json()
    return publishData.id
  }, { maxAttempts: 3, baseDelayMs: 1000, label: 'publishInstagramCarousel' })
}

export async function getInstagramPostStats(mediaId: string) {
  return withRetry(async () => {
    const fields = 'impressions,reach,likes_count,comments_count,shares,saved,total_interactions'
    const res = await fetch(
      `${META_BASE}/${mediaId}/insights?metric=${fields}&access_token=${TOKEN}`
    )
    const data = await res.json()
    const metrics: Record<string, number> = {}
    for (const item of data.data || []) {
      metrics[item.name] = item.values?.[0]?.value || 0
    }
    const impressions = metrics.impressions || 0
    const interactions = metrics.total_interactions || 0
    return {
      impressions,
      reach: metrics.reach || 0,
      likes: metrics.likes_count || 0,
      comments: metrics.comments_count || 0,
      shares: metrics.shares || 0,
      saves: metrics.saved || 0,
      clicks: 0,
      engagement_rate: impressions ? parseFloat(((interactions / impressions) * 100).toFixed(2)) : 0
    }
  }, { maxAttempts: 3, baseDelayMs: 500, label: 'getInstagramPostStats' })
}
```

- [ ] **Step 6.4 : Build de vérification**

```bash
cd /c/Users/ethaa/0flaw-content-hub && npm run build 2>&1 | tail -20
```

Attendu : build réussi.

- [ ] **Step 6.5 : Commit**

```bash
cd /c/Users/ethaa/0flaw-content-hub
git add lib/retry.ts lib/linkedin.ts lib/instagram.ts
git commit -m "feat: retry exponential backoff sur les appels LinkedIn/Instagram (3 tentatives)"
```

---

## Task 7 — Pagination cursor-based sur GET /api/posts

**Problème :** `GET /api/posts` retourne tous les posts sans limite. À 1000+ posts, la réponse devient lente et la mémoire explose côté client.

**Files:**
- Modify: `app/api/posts/route.ts`

- [ ] **Step 7.1 : Modifier le GET handler dans app/api/posts/route.ts**

```typescript
// GET /api/posts?from=...&to=...&status=...&platform=...&limit=50&cursor=<uuid>
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const status = searchParams.get('status')
  const platform = searchParams.get('platform')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)
  const cursor = searchParams.get('cursor') // UUID du dernier item reçu

  let query = supabaseAdmin
    .from('posts')
    .select('*')
    .order('scheduled_at', { ascending: true })
    .order('id', { ascending: true }) // tie-breaker stable
    .limit(limit + 1) // +1 pour savoir s'il y a une page suivante

  if (from) query = query.gte('scheduled_at', from)
  if (to) query = query.lte('scheduled_at', to)
  if (status) query = query.eq('status', status)
  if (platform) query = query.contains('platforms', [platform])

  // Cursor-based pagination : reprendre après le dernier id reçu
  if (cursor) {
    // Récupérer le scheduled_at du cursor pour continuer après lui
    const { data: cursorPost } = await supabaseAdmin
      .from('posts')
      .select('scheduled_at, id')
      .eq('id', cursor)
      .single()

    if (cursorPost) {
      query = query.or(
        `scheduled_at.gt.${cursorPost.scheduled_at},and(scheduled_at.eq.${cursorPost.scheduled_at},id.gt.${cursorPost.id})`
      )
    }
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const posts = data ?? []
  const hasMore = posts.length > limit
  const page = hasMore ? posts.slice(0, limit) : posts
  const nextCursor = hasMore ? page[page.length - 1].id : null

  return NextResponse.json({ posts: page, nextCursor, hasMore })
}
```

- [ ] **Step 7.2 : Build de vérification**

```bash
cd /c/Users/ethaa/0flaw-content-hub && npm run build 2>&1 | tail -20
```

Attendu : build réussi.

**Note :** Les pages frontend qui appellent `/api/posts` recevront maintenant `{ posts, nextCursor, hasMore }` au lieu de `{ posts }`. Vérifier que les pages calendar, history et dashboard destructurent correctement :

```bash
grep -rn "api/posts" /c/Users/ethaa/0flaw-content-hub/app --include="*.tsx" | grep fetch
```

Pour chaque page qui fait `const { posts } = await res.json()` — aucun changement nécessaire si elle ne pagine pas. La clé `posts` est toujours présente.

- [ ] **Step 7.3 : Commit**

```bash
cd /c/Users/ethaa/0flaw-content-hub
git add app/api/posts/route.ts
git commit -m "feat: pagination cursor-based sur GET /api/posts (limit + nextCursor)"
```

---

## Task 8 — Observabilité avec Sentry

**Problème :** Les erreurs en production (crashes API, erreurs Claude, timeouts LinkedIn) ne sont pas notifiées. On découvre les problèmes quand un utilisateur le signale.

**Files:**
- Create: `sentry.client.config.ts`
- Create: `sentry.server.config.ts`
- Create: `sentry.edge.config.ts`
- Modify: `next.config.js`

- [ ] **Step 8.1 : Installer le SDK Sentry**

```bash
cd /c/Users/ethaa/0flaw-content-hub && npm install @sentry/nextjs
```

- [ ] **Step 8.2 : Créer sentry.client.config.ts**

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.0,
})
```

- [ ] **Step 8.3 : Créer sentry.server.config.ts**

```typescript
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
})
```

- [ ] **Step 8.4 : Créer sentry.edge.config.ts**

```typescript
// sentry.edge.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
})
```

- [ ] **Step 8.5 : Modifier next.config.js**

Lire le contenu actuel de `next.config.js` puis le remplacer :

```javascript
// next.config.js
const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // configuration existante ici (garder si présente)
}

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
})
```

- [ ] **Step 8.6 : Ajouter les variables d'environnement**

Ajouter dans `.env.local` :
```
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ORG=0flaw
SENTRY_PROJECT=content-hub
SENTRY_AUTH_TOKEN=xxx
```

**Note :** Les valeurs sont disponibles sur sentry.io > Settings > Projects > content-hub > SDK Setup. Créer un projet si nécessaire.

- [ ] **Step 8.7 : Capturer les erreurs dans GlobalErrorBoundary**

Modifier `components/GlobalErrorBoundary.tsx`, dans `componentDidCatch` :

```typescript
import * as Sentry from '@sentry/nextjs'

componentDidCatch(error: Error, info: React.ErrorInfo) {
  console.error('[GlobalErrorBoundary]', error, info.componentStack)
  Sentry.captureException(error, { extra: { componentStack: info.componentStack } })
}
```

- [ ] **Step 8.8 : Build de vérification**

```bash
cd /c/Users/ethaa/0flaw-content-hub && npm run build 2>&1 | tail -30
```

Attendu : build réussi. Si warning Sentry "no DSN" : normal en local si NEXT_PUBLIC_SENTRY_DSN n'est pas défini, Sentry ne s'initialise pas.

- [ ] **Step 8.9 : Commit**

```bash
cd /c/Users/ethaa/0flaw-content-hub
git add sentry.client.config.ts sentry.server.config.ts sentry.edge.config.ts next.config.js components/GlobalErrorBoundary.tsx
git commit -m "feat: intégration Sentry pour tracking erreurs production"
```

---

## Task 9 — Cache Vercel KV sur les appels Claude

**Problème :** Chaque génération appelle Claude 4x (3 descriptions + slides) même pour un topic déjà généré. Coût : ~$0.05/appel. Cache = 0 coût pour regenerations.

**Files:**
- Modify: `lib/claude.ts`
- Modify: `lib/slides-gen.ts`

- [ ] **Step 9.1 : Installer @vercel/kv**

```bash
cd /c/Users/ethaa/0flaw-content-hub && npm install @vercel/kv
```

- [ ] **Step 9.2 : Lire lib/claude.ts pour comprendre la structure**

```bash
cat /c/Users/ethaa/0flaw-content-hub/lib/claude.ts
```

- [ ] **Step 9.3 : Créer lib/kv-cache.ts — wrapper générique**

```typescript
// lib/kv-cache.ts
import { createClient } from '@vercel/kv'

// KV uniquement disponible en production Vercel. En local, pas de cache.
function getKV() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null
  return createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  })
}

const TTL_SECONDS = 60 * 60 * 24 * 7 // 7 jours

export async function cachedOr<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  const kv = getKV()
  if (!kv) return fn() // pas de cache en local

  const cached = await kv.get<T>(key)
  if (cached !== null && cached !== undefined) return cached

  const result = await fn()
  await kv.set(key, result, { ex: TTL_SECONDS })
  return result
}
```

- [ ] **Step 9.4 : Modifier lib/claude.ts pour utiliser le cache**

Lire le fichier actuel puis ajouter le cache autour de l'appel API :

```typescript
// lib/claude.ts
import { cachedOr } from './kv-cache'

// Ajouter avant/autour de l'appel API existant dans generatePostDescription :
export async function generatePostDescription(topic: string, variant: 'v1' | 'v2' | 'v3'): Promise<string> {
  const cacheKey = `desc:${variant}:${topic.toLowerCase().trim().replace(/\s+/g, '-').slice(0, 80)}`
  return cachedOr(cacheKey, async () => {
    // ... code existant de génération Claude
  })
}
```

- [ ] **Step 9.5 : Modifier lib/slides-gen.ts pour utiliser le cache**

```typescript
// lib/slides-gen.ts
import { cachedOr } from './kv-cache'

export async function generateCarouselSlides(title: string, topic: string): Promise<Slide[]> {
  const cacheKey = `slides:${topic.toLowerCase().trim().replace(/\s+/g, '-').slice(0, 80)}`
  return cachedOr(cacheKey, async () => {
    // ... code existant de génération
  })
}
```

- [ ] **Step 9.6 : Ajouter les variables d'environnement dans .env.local**

```
KV_REST_API_URL=https://xxx.kv.vercel-storage.com
KV_REST_API_TOKEN=xxx
```

Ces valeurs sont disponibles dans le dashboard Vercel > Storage > KV > votre database.

**Note :** Sans ces variables, `getKV()` retourne `null` et le cache est silencieusement désactivé. L'app fonctionne normalement en local sans KV.

- [ ] **Step 9.7 : Build de vérification**

```bash
cd /c/Users/ethaa/0flaw-content-hub && npm run build 2>&1 | tail -20
```

Attendu : build réussi.

- [ ] **Step 9.8 : Commit**

```bash
cd /c/Users/ethaa/0flaw-content-hub
git add lib/kv-cache.ts lib/claude.ts lib/slides-gen.ts
git commit -m "feat: cache Vercel KV 7j sur les générations Claude (descriptions + slides)"
```

---

## Récapitulatif des tâches

| # | Tâche | Priorité | Dépendance |
|---|---|---|---|
| 1 | Centraliser types dans lib/types.ts | Refactor | — |
| 2 | Validation Zod sur POST bodies | P0 | — |
| 3 | Error Boundary global React | P0 | — |
| 4 | Auth Supabase + RLS multi-tenant | P0 | — |
| 5 | Settings persistés Supabase | P1 | Task 4 |
| 6 | Retry exponential backoff APIs | P1 | — |
| 7 | Pagination cursor-based | P1 | — |
| 8 | Sentry observabilité | P1 | Task 3 optionnel |
| 9 | Cache Vercel KV Claude | P2 | — |
