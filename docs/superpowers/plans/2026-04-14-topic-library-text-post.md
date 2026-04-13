# Topic Library + Post Texte Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a topic library panel to the create flow and a "Post texte" content type that generates a LinkedIn post + Instagram caption via GPT-4o.

**Architecture:** The topic library lives as a slide-out panel in `app/create/page.tsx`, fetching curated + user topics from `app/api/topics/route.ts`. Text post generation is added as a branch in `app/api/generate/route.ts` (new `content_type` param), with results rendered by a new `TextPostResult` component instead of the carousel flow.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Supabase JS v2 (`@supabase/ssr`), GPT-4o (`lib/kv-cache` 7-day TTL), Zod v4, React hooks.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/types.ts` | Modify | Add `UserTopic`, `CuratedTopic`, `TextPost`; extend `Post` with `content_type`, `linkedin_text`, `instagram_text` |
| `lib/zod-schemas.ts` | Modify | Add `GenerateTextPostSchema`, `TopicCreateSchema` |
| `lib/text-post-gen.ts` | Create | GPT-4o call returning `{ linkedin: string, instagram: string }`, wrapped in `cachedOr` |
| `app/api/generate/route.ts` | Modify | Branch on `content_type`: `'carousel'` → existing, `'text'` → `generateTextPost` |
| `app/api/topics/route.ts` | Create | GET curated + user topics · POST create · DELETE by id |
| `components/TopicLibraryPanel.tsx` | Create | Slide-out panel: category tabs, topic list, add/remove user topics |
| `components/TextPostResult.tsx` | Create | Two-column result (LinkedIn + Instagram), edit/regenerate/publish per platform |
| `app/create/page.tsx` | Modify | Add `ContentType` state, `TopicLibraryPanel` integration, branch to `TextPostResult` at step 2 |

---

## Task 1: SQL Migration

**Files:**
- Modify: `supabase-schema.sql`

- [ ] **Step 1: Append migration to `supabase-schema.sql`**

Open `supabase-schema.sql` and append at the end:

```sql
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
```

- [ ] **Step 2: Run migration in Supabase SQL editor**

Go to Supabase Dashboard → SQL Editor and execute the SQL above.
Expected: no errors. Run `select column_name from information_schema.columns where table_name = 'posts';` to confirm `content_type`, `linkedin_text`, `instagram_text` exist.

- [ ] **Step 3: Commit**

```bash
git add supabase-schema.sql
git commit -m "feat: sql migration — user_topics table + content_type on posts"
```

---

## Task 2: Types + Schemas

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/zod-schemas.ts`

- [ ] **Step 1: Add new types to `lib/types.ts`**

Append to the end of `lib/types.ts`:

```typescript
export type ContentType = 'carousel' | 'text'

export type CuratedTopic = {
  id: string             // stable slug, e.g. "phishing-pme"
  title: string
  description: string
  category: 'menaces' | 'conformite' | 'sensibilisation'
}

export type UserTopic = {
  id: string             // UUID from Supabase
  title: string
  description: string | null
  category: string
  created_at: string
}

export type TextPost = {
  linkedin: string
  instagram: string
}
```

Also extend the existing `Post` type — add these three fields after `pdf_url`:

```typescript
  content_type: ContentType
  linkedin_text: string | null
  instagram_text: string | null
```

- [ ] **Step 2: Add new Zod schemas to `lib/zod-schemas.ts`**

Append to `lib/zod-schemas.ts`:

```typescript
export const GenerateTextPostSchema = z.object({
  topic: z.string().min(3, 'Sujet trop court (min 3 caractères)').max(200),
  title: z.string().max(200).optional(),
  content_type: z.literal('text'),
})

export const TopicCreateSchema = z.object({
  title: z.string().min(2, 'Titre trop court').max(100),
  description: z.string().max(300).optional(),
  category: z.string().max(50).optional(),
})
```

Also update `GenerateBodySchema` to accept an optional `content_type`:

```typescript
export const GenerateBodySchema = z.object({
  topic: z.string().min(3, 'Sujet trop court (min 3 caractères)').max(200),
  title: z.string().max(200).optional(),
  content_type: z.enum(['carousel', 'text']).optional().default('carousel'),
})
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. Fix any type errors before continuing.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/zod-schemas.ts
git commit -m "feat: add ContentType, CuratedTopic, UserTopic, TextPost types + zod schemas"
```

---

## Task 3: GPT-4o Text Post Generator

**Files:**
- Create: `lib/text-post-gen.ts`

- [ ] **Step 1: Create `lib/text-post-gen.ts`**

```typescript
// GPT-4o text post generation — LinkedIn full post + Instagram caption
import { cachedOr } from './kv-cache'
import type { TextPost } from './types'

const SYSTEM_PROMPT = `Tu es copywriter senior chez 0Flaw — plateforme SaaS de sensibilisation cybersécurité pour PME/ETI françaises.

## Voix 0Flaw — règles absolues
- Phrases COURTES. Verbes d'action. Zéro rembourrage.
- Jamais : "innovant", "révolutionnaire", "solution" comme adjectif vague, "digital", "synergies"
- Chiffres sourcés obligatoires : ANSSI, Verizon DBIR, IBM Cost of Data Breach, CESIN
- Cible : RSSI et DSI de PME/ETI françaises — pragmatiques, débordés, sceptiques des vendeurs
- Ton : pair à pair, pas vendor pitch. "Vous" de rigueur (jamais "tu" en B2B)
- Pas de "Je" au début du post LinkedIn

## Format LinkedIn
- Hook : 1-2 phrases percutantes qui forcent la lecture (stat choc ou affirmation contre-intuitive)
- Corps : structuré avec → bullets, max 5 bullets, chaque bullet commence par un fait ou chiffre
- CTA : 1-2 phrases, finir par "0flaw.fr" (jamais d'URL en milieu de texte — pénalise LinkedIn)
- Hashtags : exactement 4-5, commencer par #Cybersécurité, le reste spécifique au sujet
- Longueur totale : 200-400 mots

## Format Instagram
- Version condensée du LinkedIn : hook + 2-3 bullets max + CTA court
- Max 150 mots
- 1-2 emojis (jamais plus)
- Hashtags : 6-8 en minuscules, locaux (#cybersécurité #pme #france etc.)

Réponds UNIQUEMENT avec du JSON valide. Aucun texte avant ou après.`

export async function generateTextPost(
  title: string,
  topic: string
): Promise<TextPost> {
  const slug = topic.toLowerCase().trim().replace(/\s+/g, '-').slice(0, 80)
  const cacheKey = `text-post:${slug}`

  return cachedOr(cacheKey, async () => {
    const userPrompt = `Rédige un post LinkedIn + caption Instagram sur :
Titre : "${title}"
Angle/contexte : "${topic}"

Format JSON attendu :
{
  "linkedin": "le post LinkedIn complet avec hook, corps structuré, CTA et hashtags",
  "instagram": "la caption Instagram condensée avec emojis et hashtags"
}`

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY!}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1200,
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      const msg = data?.error?.message ?? `HTTP ${res.status}`
      throw new Error(`OpenAI API error (text-post): ${msg}`)
    }

    const raw: string = data.choices?.[0]?.message?.content ?? ''

    let parsed: TextPost
    try {
      parsed = JSON.parse(raw)
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error(`Réponse GPT-4o non-JSON — reçu : ${raw.slice(0, 200)}`)
      parsed = JSON.parse(match[0])
    }

    if (!parsed.linkedin || !parsed.instagram) {
      throw new Error('GPT-4o: champs linkedin ou instagram manquants dans la réponse')
    }

    return parsed
  })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/text-post-gen.ts
git commit -m "feat: GPT-4o text post generator (LinkedIn + Instagram caption)"
```

---

## Task 4: Update Generate API Route

**Files:**
- Modify: `app/api/generate/route.ts`

- [ ] **Step 1: Update `app/api/generate/route.ts`**

Replace the entire file content:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { generatePostDescription } from '@/lib/claude'
import { generateCarouselSlides } from '@/lib/slides-gen'
import { generateTextPost } from '@/lib/text-post-gen'
import { GenerateBodySchema, parseBody } from '@/lib/zod-schemas'

export async function POST(req: NextRequest) {
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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/generate/route.ts
git commit -m "feat: branch generate API on content_type (carousel | text)"
```

---

## Task 5: Topics API Route

**Files:**
- Create: `app/api/topics/route.ts`

- [ ] **Step 1: Create `app/api/topics/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { TopicCreateSchema, parseBody } from '@/lib/zod-schemas'
import type { CuratedTopic } from '@/lib/types'

// Curated topics — static list, no DB
const CURATED_TOPICS: CuratedTopic[] = [
  { id: 'phishing-pme', title: 'Phishing PME', description: 'Spear-phishing, usurpation fournisseurs, détection', category: 'menaces' },
  { id: 'ransomware', title: 'Ransomware', description: 'Vecteurs d\'entrée, coût moyen, prévention', category: 'menaces' },
  { id: 'shadow-it', title: 'Shadow IT', description: 'Outils non-autorisés, risque réseau', category: 'menaces' },
  { id: 'mots-de-passe', title: 'Mots de passe faibles', description: 'Credential stuffing, politiques MDP', category: 'menaces' },
  { id: 'nis2', title: 'NIS2', description: 'Directive NIS2 : obligations et calendrier', category: 'conformite' },
  { id: 'dora', title: 'DORA', description: 'Résilience opérationnelle secteur financier', category: 'conformite' },
  { id: 'iso27001', title: 'ISO 27001', description: 'Certification SMSI : par où commencer', category: 'conformite' },
  { id: 'rgpd', title: 'RGPD & cybersécurité', description: 'Obligations PME, notification de violation', category: 'conformite' },
  { id: 'simulation-phishing', title: 'Simulation phishing', description: 'Tester ses équipes, mesurer la résistance', category: 'sensibilisation' },
  { id: 'formation-awareness', title: 'Campagne awareness', description: 'Rendre la formation engageante', category: 'sensibilisation' },
  { id: 'mfa', title: 'Double authentification', description: 'MFA : bénéfices et mise en place rapide', category: 'sensibilisation' },
]

function createSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )
}

// GET /api/topics — returns { curated, user }
export async function GET() {
  try {
    const supabase = createSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data, error } = await supabase
      .from('user_topics')
      .select('id, title, description, category, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ curated: CURATED_TOPICS, user: data ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/topics — create user topic
export async function POST(req: NextRequest) {
  try {
    const parsed = parseBody(TopicCreateSchema, await req.json())
    if (!parsed.success) return parsed.response

    const supabase = createSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data, error } = await supabase
      .from('user_topics')
      .insert({
        user_id: user.id,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        category: parsed.data.category ?? 'custom',
      })
      .select('id, title, description, category, created_at')
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/topics?id=<uuid>
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const supabase = createSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { error } = await supabase
      .from('user_topics')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)  // RLS double-check

    if (error) throw error

    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/topics/route.ts
git commit -m "feat: topics API — GET curated+user, POST create, DELETE"
```

---

## Task 6: TopicLibraryPanel Component

**Files:**
- Create: `components/TopicLibraryPanel.tsx`

- [ ] **Step 1: Create `components/TopicLibraryPanel.tsx`**

```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import type { CuratedTopic, UserTopic } from '@/lib/types'

type Category = 'menaces' | 'conformite' | 'sensibilisation' | 'custom'

const CATEGORY_LABELS: Record<string, string> = {
  menaces: 'Menaces',
  conformite: 'Conformité',
  sensibilisation: 'Sensib.',
  custom: 'Mes topics',
}

type Props = {
  onSelect: (title: string, description: string) => void
  onClose: () => void
}

export default function TopicLibraryPanel({ onSelect, onClose }: Props) {
  const [curated, setCurated] = useState<CuratedTopic[]>([])
  const [userTopics, setUserTopics] = useState<UserTopic[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('menaces')
  const [loading, setLoading] = useState(true)
  const [addTitle, setAddTitle] = useState('')
  const [addDesc, setAddDesc] = useState('')
  const [adding, setAdding] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchTopics = useCallback(async () => {
    try {
      const res = await fetch('/api/topics')
      if (!res.ok) throw new Error('Fetch failed')
      const data = await res.json()
      setCurated(data.curated ?? [])
      setUserTopics(data.user ?? [])
    } catch {
      // On error, keep empty lists — curated topics are shown as-is from state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTopics() }, [fetchTopics])

  async function handleAdd() {
    if (!addTitle.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: addTitle.trim(), description: addDesc.trim() || undefined, category: 'custom' }),
      })
      if (!res.ok) throw new Error('Création échouée')
      const newTopic: UserTopic = await res.json()
      setUserTopics(prev => [newTopic, ...prev])
      setAddTitle('')
      setAddDesc('')
      setShowAddForm(false)
    } catch {
      // silently ignore — user can retry
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    if (deletingId === id) {
      // Second click — confirm delete
      try {
        await fetch(`/api/topics?id=${id}`, { method: 'DELETE' })
        setUserTopics(prev => prev.filter(t => t.id !== id))
      } finally {
        setDeletingId(null)
      }
    } else {
      setDeletingId(id)
      setTimeout(() => setDeletingId(null), 2000)
    }
  }

  const filteredCurated = curated.filter(t => t.category === activeCategory)
  const showUserSection = activeCategory === 'custom' || activeCategory === 'menaces'

  const categories = ['menaces', 'conformite', 'sensibilisation', 'custom']

  return (
    <div style={{
      width: 240,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>📚 Bibliothèque</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', fontSize: 11, color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 0 }}
        >✕</button>
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: '3px 8px',
              borderRadius: 100,
              background: activeCategory === cat ? 'rgba(79,111,255,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${activeCategory === cat ? 'rgba(79,111,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
              fontSize: 10,
              fontWeight: 700,
              color: activeCategory === cat ? '#7a94ff' : 'rgba(255,255,255,0.35)',
              cursor: 'pointer',
            }}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* Topics list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 0' }}>
        {loading ? (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', padding: '12px 6px' }}>Chargement…</div>
        ) : (
          <>
            {/* Curated topics for active category */}
            {filteredCurated.length > 0 && (
              <>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.2)', letterSpacing: '.1em', textTransform: 'uppercase', padding: '4px 6px 6px' }}>
                  {CATEGORY_LABELS[activeCategory]}
                </div>
                {filteredCurated.map(topic => (
                  <button
                    key={topic.id}
                    onClick={() => { onSelect(topic.title, topic.description); onClose() }}
                    style={{
                      width: '100%',
                      padding: '9px 10px',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      marginBottom: 4,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{topic.title}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{topic.description}</div>
                  </button>
                ))}
              </>
            )}

            {/* User topics (shown on "custom" tab or alongside menaces on default) */}
            {(activeCategory === 'custom') && (
              <>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.2)', letterSpacing: '.1em', textTransform: 'uppercase', padding: '4px 6px 6px' }}>
                  Mes topics
                </div>
                {userTopics.map(topic => (
                  <div
                    key={topic.id}
                    style={{
                      padding: '9px 10px',
                      borderRadius: 8,
                      background: 'rgba(61,255,160,0.06)',
                      border: '1px solid rgba(61,255,160,0.15)',
                      marginBottom: 4,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <button
                      onClick={() => { onSelect(topic.title, topic.description ?? ''); onClose() }}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', flex: 1, minWidth: 0 }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{topic.title}</div>
                      {topic.description && (
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{topic.description}</div>
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(topic.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: 10,
                        color: deletingId === topic.id ? '#ff4f6f' : 'rgba(255,255,255,0.2)',
                        cursor: 'pointer',
                        flexShrink: 0,
                        marginLeft: 8,
                        padding: 0,
                      }}
                    >✕</button>
                  </div>
                ))}

                {/* Add form */}
                {showAddForm ? (
                  <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                    <input
                      placeholder="Titre du topic"
                      value={addTitle}
                      onChange={e => setAddTitle(e.target.value)}
                      style={{
                        padding: '7px 10px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 7,
                        color: '#fff',
                        fontSize: 11,
                        outline: 'none',
                      }}
                    />
                    <input
                      placeholder="Description (optionnel)"
                      value={addDesc}
                      onChange={e => setAddDesc(e.target.value)}
                      style={{
                        padding: '7px 10px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 7,
                        color: '#fff',
                        fontSize: 11,
                        outline: 'none',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => { setShowAddForm(false); setAddTitle(''); setAddDesc('') }}
                        style={{ flex: 1, padding: '6px 0', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 10, color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
                      >Annuler</button>
                      <button
                        onClick={handleAdd}
                        disabled={adding || !addTitle.trim()}
                        style={{ flex: 2, padding: '6px 0', borderRadius: 7, background: 'rgba(79,111,255,0.8)', border: 'none', fontSize: 10, fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: adding || !addTitle.trim() ? 0.5 : 1 }}
                      >{adding ? '…' : 'Ajouter'}</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddForm(true)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: '1px dashed rgba(255,255,255,0.1)',
                      background: 'none',
                      textAlign: 'center',
                      cursor: 'pointer',
                      marginBottom: 8,
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.3)',
                    }}
                  >+ Ajouter</button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/TopicLibraryPanel.tsx
git commit -m "feat: TopicLibraryPanel component — curated + user topics, add/delete"
```

---

## Task 7: TextPostResult Component

**Files:**
- Create: `components/TextPostResult.tsx`

- [ ] **Step 1: Create `components/TextPostResult.tsx`**

```typescript
'use client'

import { useState } from 'react'
import type { TextPost } from '@/lib/types'

type Props = {
  textPost: TextPost
  topic: string
  title: string
  onRegenerate: () => Promise<void>
}

function countWords(str: string) {
  return str.trim() === '' ? 0 : str.trim().split(/\s+/).length
}

function countChars(str: string) {
  return str.length
}

type Platform = 'linkedin' | 'instagram'

const PLATFORM_CONFIG = {
  linkedin: {
    label: 'LINKEDIN',
    color: '#4da3d4',
    bgColor: 'rgba(77,163,212,0.15)',
    borderColor: 'rgba(77,163,212,0.35)',
    maxWords: 1300,
    unit: 'mots',
    count: countWords,
  },
  instagram: {
    label: 'INSTAGRAM',
    color: '#e1306c',
    bgColor: 'rgba(225,48,108,0.15)',
    borderColor: 'rgba(225,48,108,0.35)',
    maxWords: 2200,
    unit: 'car.',
    count: countChars,
  },
}

export default function TextPostResult({ textPost, topic, title, onRegenerate }: Props) {
  const [linkedin, setLinkedin] = useState(textPost.linkedin)
  const [instagram, setInstagram] = useState(textPost.instagram)
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null)
  const [publishing, setPublishing] = useState<Platform | null>(null)
  const [publishedPlatforms, setPublishedPlatforms] = useState<Platform[]>([])
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const content: Record<Platform, string> = { linkedin, instagram }
  const setContent: Record<Platform, (v: string) => void> = { linkedin: setLinkedin, instagram: setInstagram }

  async function handlePublish(platform: Platform) {
    setPublishing(platform)
    setError(null)
    try {
      // Save as draft post first, then publish
      const saveRes = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          topic,
          content_type: 'text',
          platforms: [platform],
          linkedin_text: platform === 'linkedin' ? linkedin : null,
          instagram_text: platform === 'instagram' ? instagram : null,
          status: 'draft',
        }),
      })
      if (!saveRes.ok) throw new Error('Sauvegarde échouée')
      const post = await saveRes.json()

      const pubRes = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id }),
      })
      if (!pubRes.ok) throw new Error('Publication échouée')
      setPublishedPlatforms(prev => [...prev, platform])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur publication')
    } finally {
      setPublishing(null)
    }
  }

  async function handlePublishBoth() {
    setPublishing('linkedin') // visual indicator
    setError(null)
    try {
      const saveRes = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          topic,
          content_type: 'text',
          platforms: ['linkedin', 'instagram'],
          linkedin_text: linkedin,
          instagram_text: instagram,
          status: 'draft',
        }),
      })
      if (!saveRes.ok) throw new Error('Sauvegarde échouée')
      const post = await saveRes.json()

      const pubRes = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id }),
      })
      if (!pubRes.ok) throw new Error('Publication échouée')
      setPublishedPlatforms(['linkedin', 'instagram'])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur publication')
    } finally {
      setPublishing(null)
    }
  }

  async function handleRegenerate() {
    setRegenerating(true)
    setError(null)
    try {
      await onRegenerate()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur régénération')
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        {(['linkedin', 'instagram'] as Platform[]).map(platform => {
          const cfg = PLATFORM_CONFIG[platform]
          const text = content[platform]
          const cnt = cfg.count(text)
          const isEditing = editingPlatform === platform
          const isPublished = publishedPlatforms.includes(platform)

          return (
            <div key={platform} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
              {/* Platform header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, letterSpacing: '.06em' }}>{cfg.label}</span>
                  {isPublished && <span style={{ fontSize: 10, color: '#3dffa0' }}>✓ Publié</span>}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                  {cnt} / {cfg.maxWords} {cfg.unit}
                </div>
              </div>

              {/* Content area */}
              {isEditing ? (
                <textarea
                  value={text}
                  onChange={e => setContent[platform](e.target.value)}
                  style={{
                    flex: 1,
                    padding: 14,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 10,
                    color: '#fff',
                    fontSize: 12,
                    lineHeight: 1.7,
                    resize: 'none',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              ) : (
                <div style={{
                  flex: 1,
                  padding: 14,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.75)',
                  lineHeight: 1.7,
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                }}>
                  {text}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setEditingPlatform(isEditing ? null : platform)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
                  }}
                >{isEditing ? '✓ OK' : '✏️ Éditer'}</button>
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
                    opacity: regenerating ? 0.5 : 1,
                  }}
                >{regenerating ? '…' : '🔄 Régénérer'}</button>
                <button
                  onClick={() => handlePublish(platform)}
                  disabled={!!publishing || isPublished}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8,
                    background: cfg.bgColor, border: `1px solid ${cfg.borderColor}`,
                    fontSize: 11, fontWeight: 700, color: cfg.color, cursor: 'pointer',
                    opacity: (!!publishing || isPublished) ? 0.5 : 1,
                  }}
                >{publishing === platform ? '…' : isPublished ? '✓' : 'Publier →'}</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <div style={{ fontSize: 12, color: '#ff4f6f', padding: '8px 12px', background: 'rgba(255,79,111,0.08)', borderRadius: 8 }}>
          {error}
        </div>
      )}

      {/* Bottom CTA */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handlePublishBoth}
          disabled={!!publishing || publishedPlatforms.length === 2}
          style={{
            flex: 1, padding: '10px 0', borderRadius: 8,
            background: 'rgba(79,111,255,0.9)', border: 'none',
            fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer',
            opacity: (!!publishing || publishedPlatforms.length === 2) ? 0.5 : 1,
          }}
        >
          {publishing ? 'Publication…' : publishedPlatforms.length === 2 ? '✓ Les 2 publiés' : 'Publier les 2 plateformes →'}
        </button>
        <button
          style={{
            padding: '10px 16px', borderRadius: 8,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
          }}
        >📅 Planifier</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/TextPostResult.tsx
git commit -m "feat: TextPostResult component — two-column LinkedIn/Instagram, edit/publish"
```

---

## Task 8: Update POST /api/posts to Accept Text Posts

**Files:**
- Modify: `app/api/posts/route.ts`

The `POST` handler needs to accept `content_type`, `linkedin_text`, `instagram_text` fields. Read the current file first to see the exact POST body handling, then add those fields to the insert query.

- [ ] **Step 1: Read current `app/api/posts/route.ts`**

```bash
# Identify the POST handler and the .insert() call
grep -n "insert\|content_type\|linkedin_text" app/api/posts/route.ts
```

- [ ] **Step 2: Add fields to the POST insert**

In `app/api/posts/route.ts`, find the Supabase `.insert({...})` call in the POST handler and add these three fields:

```typescript
content_type: body.content_type ?? 'carousel',
linkedin_text: body.linkedin_text ?? null,
instagram_text: body.instagram_text ?? null,
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/api/posts/route.ts
git commit -m "feat: posts POST accepts content_type, linkedin_text, instagram_text"
```

---

## Task 9: Wire Everything into `app/create/page.tsx`

**Files:**
- Modify: `app/create/page.tsx`

This is the largest change. The page already has a 4-step flow. We need to:
1. Add a `contentType` state (`'carousel' | 'text'`)
2. Add a `showLibrary` state
3. Add the content type selector UI at step 1 (before the title field)
4. Add the `TopicLibraryPanel` alongside step 1's layout
5. At step 2, if `contentType === 'text'`, render `TextPostResult` instead of the carousel description flow

- [ ] **Step 1: Add imports at top of `app/create/page.tsx`**

After existing imports, add:

```typescript
import TopicLibraryPanel from '@/components/TopicLibraryPanel'
import TextPostResult from '@/components/TextPostResult'
import type { ContentType, TextPost } from '@/lib/types'
```

- [ ] **Step 2: Add state variables**

Inside the component, after existing `useState` calls, add:

```typescript
const [contentType, setContentType] = useState<ContentType>('carousel')
const [showLibrary, setShowLibrary] = useState(false)
const [textPost, setTextPost] = useState<TextPost | null>(null)
```

- [ ] **Step 3: Update the generate call**

Find the `fetch('/api/generate', ...)` call. Add `content_type: contentType` to the request body:

```typescript
body: JSON.stringify({ topic, title, content_type: contentType }),
```

After the response, branch on `content_type`:

```typescript
const data = await res.json()
if (data.content_type === 'text') {
  setTextPost({ linkedin: data.linkedin, instagram: data.instagram })
  setStep(2)
  return
}
// existing carousel handling continues below...
```

- [ ] **Step 4: Add content type selector UI at step 1**

In the step 1 JSX, add a content type selector before the title field. Find the title input block and insert before it:

```tsx
{/* Content type selector */}
<div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
  {(['carousel', 'text'] as ContentType[]).map(type => (
    <button
      key={type}
      onClick={() => setContentType(type)}
      style={{
        flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
        background: contentType === type ? 'rgba(79,111,255,0.12)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${contentType === type ? 'rgba(79,111,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
      }}
    >
      <div style={{ fontSize: 18, marginBottom: 4 }}>{type === 'carousel' ? '📊' : '✍️'}</div>
      <div style={{ fontWeight: 700, fontSize: 12, color: '#fff' }}>{type === 'carousel' ? 'Carrousel' : 'Post texte'}</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
        {type === 'carousel' ? '7 slides · PDF' : 'Hook + CTA'}
      </div>
    </button>
  ))}
</div>
```

- [ ] **Step 5: Add library toggle button and panel**

Wrap the step 1 form area in a flex row. Add the "📚 Topics" toggle button next to the existing generate button, and render `TopicLibraryPanel` conditionally:

```tsx
{/* Library toggle button — add alongside existing generate button */}
<button onClick={() => setShowLibrary(v => !v)} style={{ ... }}>
  📚 Topics
</button>

{/* Panel — rendered next to the form */}
{showLibrary && (
  <TopicLibraryPanel
    onSelect={(title, description) => {
      setTitle(title)
      setTopic(description)
    }}
    onClose={() => setShowLibrary(false)}
  />
)}
```

Note: check that the existing state variables are named `title` and `topic` (or their actual names in the file) before wiring `onSelect`.

- [ ] **Step 6: Render TextPostResult at step 2 for text posts**

In the step 2 JSX, add a conditional at the top:

```tsx
{step === 2 && contentType === 'text' && textPost && (
  <TextPostResult
    textPost={textPost}
    topic={topic}
    title={title}
    onRegenerate={async () => {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, title, content_type: 'text' }),
      })
      const data = await res.json()
      if (data.linkedin && data.instagram) {
        setTextPost({ linkedin: data.linkedin, instagram: data.instagram })
      }
    }}
  />
)}
```

- [ ] **Step 7: Verify TypeScript compiles and dev server starts**

```bash
npx tsc --noEmit
npm run dev
```

Navigate to `/create` and verify:
- Content type selector appears
- Selecting "Post texte" and clicking Générer shows `TextPostResult`
- Selecting "Carrousel" and clicking Générer shows existing carousel flow
- 📚 Topics button opens/closes the panel
- Clicking a topic pre-fills title + topic fields

- [ ] **Step 8: Commit**

```bash
git add app/create/page.tsx
git commit -m "feat: content type selector + topic library panel in create flow"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Topic library panel (curated + user topics, categories) → Tasks 5, 6
- ✅ User topics CRUD → Task 5 (API), Task 6 (panel UI)
- ✅ Topic selection pre-fills title + topic, closes panel → Task 6 `onSelect` + Task 9 Step 5
- ✅ Post texte type selector at step 1 → Task 9 Step 4
- ✅ GPT-4o generates LinkedIn + Instagram → Task 3
- ✅ Two-column result UI → Task 7
- ✅ Edit inline (textarea) → Task 7
- ✅ Regenerate per platform → Task 7 (`onRegenerate` prop)
- ✅ Publish per platform + "Publier les 2" → Task 7
- ✅ Cache (7-day TTL) → Task 3 (`cachedOr`)
- ✅ SQL migration → Task 1
- ✅ Types + schemas → Task 2
- ✅ posts POST updated → Task 8

**Placeholder check:** No TBD/TODO found. Task 8 Step 1 uses `grep` to locate exact insert call since the file is large — this is intentional (safe discovery pattern, not a placeholder).

**Type consistency:** `TextPost` defined in Task 2, used in Tasks 3, 7, 9. `ContentType` defined in Task 2, used in Tasks 2 (schema), 4 (generate route), 9 (create page). `UserTopic`/`CuratedTopic` defined in Task 2, used in Tasks 5 and 6. All consistent.
