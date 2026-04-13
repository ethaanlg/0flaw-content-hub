# 0Flaw Content Hub

Micro-SaaS de gestion de contenu LinkedIn & Instagram pour 0Flaw.

## Stack
- **Next.js 14** (App Router) — frontend + API routes
- **Supabase** — base de données + auth
- **Vercel** — hébergement + Cron Jobs
- **LinkedIn API v2** — publication + stats
- **Meta Graph API** — Instagram Business publication + stats
- **Claude API** — génération de carrousels

## Structure du projet

```
0flaw-content-hub/
├── app/
│   ├── layout.tsx           # Layout global
│   ├── page.tsx             # / → Créer un post
│   ├── calendar/page.tsx    # /calendar → Calendrier éditorial
│   ├── analytics/page.tsx   # /analytics → Dashboard stats
│   └── api/
│       ├── publish/route.ts      # POST → publier un post
│       ├── stats/route.ts        # GET → récupérer les stats
│       ├── generate/route.ts     # POST → générer carrousel avec Claude
│       └── cron/route.ts         # GET → Vercel Cron (autopublish)
├── lib/
│   ├── supabase.ts          # Client Supabase
│   ├── linkedin.ts          # LinkedIn API helpers
│   ├── instagram.ts         # Meta Graph API helpers
│   └── claude.ts            # Claude API helper
├── components/
│   ├── Nav.tsx              # Navigation
│   ├── PostCard.tsx         # Carte post
│   ├── StatsChart.tsx       # Graphique stats
│   └── CalendarGrid.tsx     # Grille calendrier
├── .env.local.example       # Variables d'environnement
├── vercel.json              # Config Cron Jobs
└── supabase/schema.sql      # Schéma base de données
```

## Installation

```bash
# 1. Cloner et installer
git clone <repo>
cd 0flaw-content-hub
npm install

# 2. Créer le projet Supabase sur supabase.com
# 3. Exécuter supabase/schema.sql dans l'éditeur SQL Supabase

# 4. Copier et remplir les variables d'environnement
cp .env.local.example .env.local

# 5. Lancer en local
npm run dev

# 6. Déployer sur Vercel
vercel deploy
```

## Déploiement Vercel

1. Importer le repo sur vercel.com
2. Ajouter toutes les variables d'environnement
3. Le cron job s'active automatiquement (vercel.json)
