# Design Spec — Topic Library + Post Texte Mode

**Date:** 2026-04-14
**Branch:** fix/prioritaires
**Status:** Approved

---

## 1. Contexte

0Flaw Content Hub génère actuellement uniquement des carrousels (7 slides PDF). Deux lacunes identifiées :

1. **Pas de bibliothèque de topics** — l'utilisateur repart de zéro à chaque création, sans accès à des angles pré-validés.
2. **Pas de post texte** — le seul format supporté est le carrousel. Les posts LinkedIn/Instagram texte ne sont pas couverts.

Ces deux features sont interdépendantes : la bibliothèque de topics fonctionne pour les deux types de contenu.

---

## 2. Fonctionnalités

### 2.1 Bibliothèque de topics

**Périmètre :**
- Liste curated de topics cybersécurité (côté serveur, non modifiable par l'utilisateur)
- Section "Mes topics" : topics personnalisés créés par l'utilisateur (stockés en base)
- Organisation par catégories : Menaces · Conformité · Sensibilisation
- Sélection d'un topic → pré-remplit `title` + `topic` dans le formulaire de création

**Topics curated (initiaux) :**
- *Menaces* : Phishing PME, Ransomware, Shadow IT, Mots de passe faibles
- *Conformité* : NIS2, DORA, ISO 27001, RGPD
- *Sensibilisation* : Simulation phishing, Campagne awareness, Formation collaborateurs

**Topics utilisateur :**
- Création via "+ Ajouter" dans le panneau bibliothèque
- Suppression via ✕ sur chaque topic
- Stockés dans une nouvelle table Supabase `user_topics`

**UI :**
- Panneau latéral (240px) qui s'ouvre/ferme via bouton "📚 Topics" sur l'étape 1
- Filtrage par catégorie (tabs horizontaux)
- Clic sur un topic : pré-remplit les champs + ferme le panneau

### 2.2 Post texte

**Périmètre :**
- Nouveau type de contenu sélectionnable sur l'étape 1 : "Post texte" (en plus de "Carrousel")
- Génération via GPT-4o d'un post LinkedIn complet + caption Instagram condensée
- Pas de variantes (une seule version générée, régénérable)

**Contenu généré :**
- *LinkedIn* : hook (1-2 phrases), corps structuré avec → bullets, CTA + URL, 4-5 hashtags. Max 1300 mots.
- *Instagram* : version condensée du post LinkedIn (hook + 2-3 bullets + CTA). Max 2200 caractères. Hashtags locaux (#cybersécurité #pme etc.)

**UI de résultat (étape 2) :**
- Layout deux colonnes : LinkedIn (gauche) · Instagram (droite)
- Compteur de mots/caractères par colonne
- Actions par plateforme : Éditer · Régénérer · Publier
- Bouton global "Publier les 2 plateformes →" + "📅 Planifier"
- Édition inline dans un textarea (remplacement du div readonly)

**Publication :**
- Réutilise les endpoints LinkedIn/Instagram existants
- Le post texte est stocké dans `posts` avec `content_type = 'text'`

---

## 3. Architecture

### Nouveaux fichiers

| Fichier | Rôle |
|---|---|
| `lib/text-post-gen.ts` | Génération GPT-4o post texte (LinkedIn + Instagram) |
| `app/api/topics/route.ts` | GET (liste curated + user topics) · POST (créer) · DELETE (supprimer) |
| `components/TopicLibraryPanel.tsx` | Panneau bibliothèque (UI + logique fetch) |
| `components/TextPostResult.tsx` | Affichage résultat post texte (2 colonnes) |

### Modifications

| Fichier | Modification |
|---|---|
| `app/create/page.tsx` | Ajouter sélecteur type (carrousel/texte) + intégration `TopicLibraryPanel` |
| `app/api/generate/route.ts` | Brancher sur `text-post-gen` si `content_type === 'text'` |
| `lib/types.ts` | Ajouter `UserTopic`, `CuratedTopic`, étendre `Post` avec `content_type` |

### Schéma Supabase (nouvelle table)

```sql
create table user_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'custom',
  created_at timestamptz not null default now()
);

alter table user_topics enable row level security;
create policy "user_topics_rls" on user_topics
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

### Étendre `posts`

```sql
alter table posts add column if not exists content_type text not null default 'carousel';
alter table posts add column if not exists linkedin_text text;
alter table posts add column if not exists instagram_text text;
```

---

## 4. Prompt GPT-4o — Post texte

**System prompt (`lib/text-post-gen.ts`) :**
- Voix 0Flaw identique à `lib/claude.ts` (anti-fluff, chiffres sourcés, RSSI/DSI PME)
- LinkedIn : hook choc, corps structuré (→ bullets), CTA sans URL dans le corps
- Instagram : condensation automatique du LinkedIn, emojis mesurés (max 2), hashtags en minuscules

**Format de retour :** JSON `{ linkedin: string, instagram: string }` avec `response_format: { type: 'json_object' }`

**Cache :** `cachedOr` avec clé `text-post:{topic-slug}` (TTL 7 jours, identique aux slides)

---

## 5. Gestion des erreurs

- Génération GPT-4o échoue → toast d'erreur, bouton "Réessayer"
- Topic library : si fetch échoue → affiche uniquement les topics curated (statiques, pas de call API)
- Ajout topic vide → validation côté client (champ requis)
- Suppression topic → confirmation inline (bouton ✕ → passe en rouge 1s, deuxième clic confirme)

---

## 6. Hors périmètre

- Variantes de post texte (une seule version, régénérable)
- Planification depuis l'interface de résultat (bouton présent mais redirige vers /schedule existant)
- Édition rich text (textarea simple)
- Analytics par type de contenu

---

## 7. Séquence d'implémentation

1. Migration SQL (user_topics + colonnes posts)
2. `lib/text-post-gen.ts` + `app/api/generate/route.ts` branch
3. `app/api/topics/route.ts` (CRUD)
4. `components/TopicLibraryPanel.tsx`
5. `components/TextPostResult.tsx`
6. `app/create/page.tsx` (intégration)
7. `lib/types.ts` mise à jour
