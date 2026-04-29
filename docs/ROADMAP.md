# 0Flaw Content Hub — Résumé & Roadmap

> Généré le 29 avril 2026

---

## Ce qui a été construit (session complète)

### Module 1 — Migration IA (OpenAI → Anthropic Claude)
- `lib/claude.ts` — réécriture complète avec `@anthropic-ai/sdk`, cache KV
- `lib/slides-gen.ts` — tool use `generate_carousel`, validation 7 slides obligatoire
- `lib/text-post-gen.ts` — tool use `generate_text_post`, champs LinkedIn + Instagram
- Modèle utilisé : `claude-sonnet-4-5` → mis à jour en `claude-sonnet-4-6` après erreur 401

### Module 2 — Nouveaux adapters plateforme
- `lib/platforms/types.ts` — interface `PlatformAdapter` (publish / getAnalytics / refreshToken)
- `lib/platforms/linkedin-adapter.ts` — token explicite, titre PDF dérivé du texte
- `lib/platforms/instagram-adapter.ts` — token explicite, pas de mutation process.env
- `lib/platforms/x-adapter.ts` — thread mode + single tweet, guard firstId
- `lib/platforms/threads-adapter.ts` — children en array, null guard sur body.data

### Module 3 — Composer & Scheduler
- `app/api/composer/adapt/route.ts` — adaptation multi-plateforme via Claude tool use
- `app/api/cron/publish-scheduled/route.ts` — cron publication, locking optimiste, reset sur erreur
- `vercel.json` — crons once-daily (contrainte plan Hobby)

### Module 4 — Newsletter (Brevo)
- `lib/brevo.ts` — SDK Fern `@getbrevo/brevo`, escapeHtml, 4 fonctions
- `app/api/newsletter/subscribe/route.ts` — double opt-in, anti-énumération, token 48h
- `app/api/newsletter/confirm/route.ts` — expiry check, Brevo best-effort
- `supabase/migrations/004_newsletter.sql`

### Module 5 — Analytics time-series
- `app/api/cron/sync-analytics/route.ts` — sync horaire sur 30 derniers jours
- `supabase/migrations/005_post_analytics.sql`

### Module 6 — Agent IA hebdomadaire
- `lib/agent/tools.ts` — 4 tools Claude (analyze_performance, save_proposal, draft_post, propose_calendar)
- `lib/agent/content-strategist.ts` — boucle agentique max 10 itérations
- `app/inbox/page.tsx` — UI approve/edit/reject des proposals
- `app/api/cron/agent-weekly/route.ts` — cron lundi 8h
- `supabase/migrations/006_agent.sql` — pgvector agent_memory

### OAuth — Connexions plateformes
- `app/api/auth/linkedin/` + `callback/` — code flow, long-lived token
- `app/api/auth/x/` + `callback/` — PKCE S256
- `app/api/auth/instagram/` + `callback/` — Meta Graph, échange token 60 jours
- `app/api/auth/threads/` + `callback/` — graph.threads.net
- `supabase/migrations/002_platform_connections.sql`

### Corrections de bugs critiques (audit production)
- `supabase/migrations/007_posts_user_id.sql` — user_id + RLS sur table posts
- `app/api/publish/route.ts` — tokens depuis platform_connections (plus env global)
- `app/api/cron/publish-scheduled/route.ts` — auto-refresh tokens expirant
- `app/api/generate/route.ts` + `app/api/slides/route.ts` — auth guards 401
- `lib/pdf-render.tsx` — format 595×595 → 540×675 (portrait 4:5 LinkedIn)
- Suppression de 2 fichiers cron legacy dangereux

### Performances & qualité
- Sentry migré vers `instrumentation.ts` + `instrumentation-client.ts`
- Turbopack activé en dev (`npm run dev --turbo`)
- `unstable_cache` sur `/api/stats` (5min) et `/api/posts` (30s), isolation par user_id
- Lazy-load recharts via `dynamic()` sur dashboard ET analytics
- `import * as Sentry` → `import { captureException }` dans 2 fichiers
- `BarChart, Bar, subDays` (imports morts analytics) supprimés
- `<a href>` → `<Link>` dans dashboard et create (navigation client-side)
- 8 fichiers `loading.tsx` ajoutés (skeleton instantané sur toutes les routes)

---

## Migrations Supabase à appliquer (dans l'ordre)

| # | Fichier | Statut |
|---|---------|--------|
| 002 | `platform_connections` | ✅ Appliqué |
| 003 | `post_publications` | ✅ Appliqué |
| 004 | `newsletter` | ✅ Appliqué |
| 005 | `post_analytics` | ✅ Appliqué |
| 006 | `agent` (pgvector) | ✅ Appliqué |
| 007 | `posts user_id + RLS` | ✅ Appliqué |

---

## Variables d'environnement requises

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# LinkedIn
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
# optionnel — calculé depuis NEXT_PUBLIC_APP_URL
LINKEDIN_CALLBACK_URL=

# X / Twitter
X_CLIENT_ID=
X_CLIENT_SECRET=
# optionnel
X_CALLBACK_URL=

# Meta (Instagram + Threads — même app)
META_APP_ID=
META_APP_SECRET=
# optionnel
INSTAGRAM_CALLBACK_URL=
THREADS_CALLBACK_URL=

# Brevo (newsletter)
BREVO_API_KEY=
BREVO_LIST_ID=

# App
NEXT_PUBLIC_APP_URL=https://0flaw-content-hub.vercel.app
CRON_SECRET=

# Optionnel
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

---

## Ce qui reste à faire

### 🔴 Priorité haute — Fonctionnalité cassée

#### 1. `handleSave` dans `/create` contourne le serveur
- **Fichier** : `app/create/page.tsx` ~ligne 1383
- **Problème** : Appelle `supabase.from('posts').insert()` directement depuis le client avec la clé anon. Maintenant que RLS est activé sur `posts` avec `user_id`, ce code **ne peut plus insérer** (pas de `user_id` passé).
- **Fix** : Remplacer par `fetch('/api/posts', { method: 'POST', body: JSON.stringify({...}) })` qui passe par le serveur et injecte `user.id`.

#### 2. "Bonjour Ethan" hardcodé dans le dashboard
- **Fichier** : `app/dashboard/page.tsx` ligne 277
- **Fix** : Récupérer le nom depuis `supabase.auth.getUser()` et afficher `user.user_metadata.full_name ?? user.email`.

#### 3. `weekGoal = 2` hardcodé
- **Fichier** : `app/dashboard/page.tsx` ligne 243
- **Fix** : Stocker dans une table `settings` (déjà existante ?) ou en `user_metadata`.

#### 4. RLS `newsletter_campaigns` trop permissive
- **Fichier** : `supabase/migrations/004_newsletter.sql` lignes 39-42
- **Problème** : Tout utilisateur authentifié peut lire/modifier toutes les campagnes.
- **Fix** : Ajouter `user_id` à la table ou restreindre à un rôle admin.

---

### 🟡 Priorité moyenne — UX manquante

#### 5. Page `/inbox` — UI complète à vérifier
- La table `agent_proposals` est peuplée chaque lundi par le cron agent-weekly.
- La page `/inbox` existe mais n'a pas été testée en production avec de vrais proposals.
- **À faire** : Tester le flow complet → approuver un proposal → vérifier qu'il passe en draft dans `/create`.

#### 6. Notification token expirant
- Aucune alerte si un token LinkedIn/Meta/X expire.
- **Fix** : Dans `/connections`, afficher le badge "Reconnecter" en rouge si `expires_at < now + 7 jours`. Déjà partiellement là (le champ `expires_at` est affiché).

#### 7. Prévisualisation PDF avant publication
- L'utilisateur génère le carrousel mais ne voit pas les slides individuellement.
- **Fix** : Embed PDF inline dans le Step 3 du wizard `/create` avec `<iframe src={pdfUrl}>` ou un viewer react-pdf côté client.

#### 8. Bouton "Adapter" depuis `/history`
- `POST /api/composer/adapt` existe mais n'est exposé nulle part dans l'UI.
- **Fix** : Ajouter un bouton "Adapter pour X/Threads" dans la liste des posts de `/history`.

#### 9. Palette design system non respectée dans le PDF
- **Fichier** : `lib/pdf-render.tsx`
- `bg: '#0f1225'` au lieu de `#0A0A0F`, `accent: '#4f6fff'` au lieu de `#00E5FF`
- **Fix** : Mettre à jour les constantes de couleur pour matcher le design system de l'app.

---

### 🟢 Priorité basse — Améliorations

#### 10. Rate limiting sur `/api/generate`
- N'importe quel utilisateur authentifié peut appeler Claude en boucle.
- **Fix** : Ajouter un compteur via Vercel KV (`10 req/min/user`) avant l'appel Claude.

#### 11. `lib/agent/memory.ts` — pgvector non utilisé
- La table `agent_memory` (vector 1536) existe mais aucun code n'y écrit ni n'y lit.
- **Fix** : Implémenter l'embedding des proposals approuvés + retrieval dans `content-strategist.ts`.

#### 12. Route manuelle `/api/agent/run`
- L'agent ne peut être déclenché que par le cron lundi 8h.
- **Fix** : Ajouter `POST /api/agent/run` protégé par auth pour déclencher manuellement depuis `/inbox`.

#### 13. Calendrier éditorial — timezone
- Le cron `publish-scheduled` s'exécute à 08:00 UTC.
- Pour Paris (UTC+2), les posts programmés à 08:15 doivent être en base à **06:15 UTC**.
- **Fix** : Afficher et stocker les heures en UTC dans le wizard, ou ajouter une conversion timezone côté client.

#### 14. `/api/stats` GET — table `post_stats` sans colonne `user_id`
- Le cache filtre par `user_id` mais la table `post_stats` (schema.sql) n'a pas de colonne `user_id`.
- **Fix** : Soit ajouter `user_id` à `post_stats`, soit faire le JOIN via `posts.user_id`.

---

## Calendrier éditorial recommandé (rappel)

| Jour | Créneau | Contenu | Plateforme |
|------|---------|---------|------------|
| Lundi | 08:00 | Agent weekly run (auto) | — |
| Mardi | 08:15 | Carrousel éducatif cyber | LinkedIn |
| Mardi | 11:00 | Réutilisation en post texte | Instagram |
| Mercredi | 09:00 | Réaction actualité ANSSI/CERT | LinkedIn + X |
| Jeudi | 08:15 | Conformité NIS2/DORA ou preuve sociale | LinkedIn |
| Jeudi | 14:00 | Version casual du contenu | Threads |
| Vendredi | 09:00 | CTA commercial court | LinkedIn |

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 14.2.3 App Router |
| Language | TypeScript strict |
| Styling | Tailwind CSS + CSS custom properties |
| Base de données | Supabase (PostgreSQL + RLS + Storage) |
| Auth | Supabase Auth (magic link + OAuth) |
| IA | Anthropic Claude (`claude-sonnet-4-6`) |
| PDF | `@react-pdf/renderer` |
| Charts | Recharts (lazy-loaded) |
| Emails | Brevo (`@getbrevo/brevo`) |
| Monitoring | Sentry (`@sentry/nextjs`) |
| Déploiement | Vercel (plan Hobby — 1 cron/jour max) |
| Cache | Next.js `unstable_cache` |
