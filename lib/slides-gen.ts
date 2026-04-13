// GPT-4o carousel generation — structure based on 0Flaw reference carousel
// Each slide maps 1:1 to a visual template in the renderer

export type SlideTag = {
  icon?: string            // ex: "△", "€", "→", "○", emoji
  label: string            // ex: "PROBLÈME", "COÛT RÉEL", "DÉCLIC"
  color?: 'accent' | 'red' | 'green' | 'white'
}

export type Slide =
  | {
      type: 'cover'
      tag: SlideTag
      headline: string       // Main hook statement (max 10 words)
      accentPhrase: string   // The phrase within headline to render in accent color
      body: string           // 2–3 lines of context, Space Mono style
    }
  | {
      type: 'problem'
      tag: SlideTag
      headline: string       // Problem statement (max 10 words)
      accentPhrase: string   // Key phrase in accent color (red)
      bullets: string[]      // 3 evidence bullets, each starting with a fact
    }
  | {
      type: 'stat'
      tag: SlideTag
      stat: string           // Big impactful number/stat, ex: "187k€", "-68%", "3,4M"
      statLabel: string      // Source/context in small caps, ex: "COÛT MOYEN PME · ANSSI 2024"
      body: string           // 2–3 lines explaining the stat, mono style
    }
  | {
      type: 'insight'
      tag: SlideTag
      icon: string           // Emoji representing the insight
      headline: string       // Turning point headline (max 12 words)
      accentPhrase: string   // Key word/phrase to highlight in accent color (blue)
      body: string           // Short explanation 2 lines
    }
  | {
      type: 'system'
      tag: SlideTag
      headline: string       // "Le programme X" or system name headline
      steps: Array<{
        num: number          // 1–4
        text: string         // What happens at this step (max 8 words)
        timing: string       // When/duration, ex: "Lundi", "5 min", "Auto", "Vendredi"
      }>
    }
  | {
      type: 'proof'
      tag: SlideTag
      stat: string           // Result metric, ex: "-68%", "+240%"
      quote: string          // Verbatim testimonial quote (1–2 sentences)
      source: string         // Source attribution, ex: "DSI · PME INDUSTRIE · 120 COLLABORATEURS"
      bullets: string[]      // 2 additional proof points
    }
  | {
      type: 'cta'
      tag: SlideTag
      headline: string       // Action headline (max 10 words)
      accentPhrase: string   // Key phrase in accent color
      offer: string          // The specific offer, ex: "Simulation phishing gratuite pour votre PME."
      button: string         // CTA button label, ex: "0FLAW.FR →"
      credibility: string    // Trust line below button, ex: "Setup en 45 min · Résultats en 24h"
    }

const SYSTEM_PROMPT = `Tu es copywriter senior chez 0Flaw — plateforme SaaS de sensibilisation cybersécurité pour PME/ETI françaises. Tu crées des carrousels LinkedIn B2B qui génèrent des leads RSSI/DSI.

## Voix 0Flaw — règles absolues
- Phrases COURTES. Verbes d'action. Zéro rembourrage.
- Jamais : "innovant", "révolutionnaire", "solution" comme adjectif vague, "digital", "synergies"
- Chiffres sourcés obligatoires : ANSSI, Verizon DBIR, IBM Cost of Data Breach, CESIN
- Cible : RSSI et DSI de PME/ETI françaises — pragmatiques, débordés, sceptiques des vendeurs
- Ton : pair à pair, pas vendor pitch. "Vous" de rigueur (jamais "tu" en B2B)
- accentPhrase : TOUJOURS une sous-partie exacte de headline (le renderer remplace cette phrase par la couleur accent)

## Structure exacte : 7 slides dans l'ordre suivant

### Slide 1 — cover (hook choc)
- headline : affirmation provocatrice qui force le swipe. Ex: "Un de vos collabs va cliquer."
- accentPhrase : la suite choc en 2-3 mots. Ex: "Demain matin."
- body : 2 lignes expliquant pourquoi c'est inévitable sans être alarmiste

### Slide 2 — problem (le problème existant)
- tag.icon : △ (danger/triangle)
- headline : "Les [approches actuelles] ne [fonctionnent pas]." — constat brutal
- accentPhrase : la fin négative de la headline. Ex: "protègent pas."
- bullets : 3 faits concrets qui prouvent le problème. Commencer par chiffre ou durée.

### Slide 3 — stat (coût ou impact chiffré)
- tag.icon : € ou % selon le sujet
- stat : UN chiffre/stat massif et mémorable. Ex: "187k€", "3 PME/4", "-68%"
- statLabel : source en small caps. Ex: "COÛT MOYEN D'UNE CYBERATTAQUE PME · ANSSI 2024"
- body : 2-3 courtes phrases expliquant la cause réelle. La dernière en gras ("Un mail.", "Une erreur config.", etc.)

### Slide 4 — insight (le déclic / la solution contre-intuitive)
- tag.icon : → ou 💡
- headline : la vérité surprenante ou la solution simple
- accentPhrase : le mot-clé central en accent bleu. Ex: "suffisant", "15 min/jour", "sans RSSI dédié"
- body : 2 lignes qui expliquent pourquoi ça marche (mécanisme simple)

### Slide 5 — system (le programme / les étapes)
- tag.icon : ○ ou ⚙
- headline : "Le programme [X]" ou "Le système [X]" — nommer la méthode
- steps : 4 étapes numérotées avec leur timing (journée, durée, fréquence)

### Slide 6 — proof (résultat mesuré)
- tag.icon : →
- stat : le résultat principal en pourcentage ou chiffre. Ex: "-68%", "+3x"
- quote : témoignage verbatim (inventé mais crédible pour PME française). Entre guillemets.
- source : attribution format "POSTE · TYPE ENTREPRISE · N COLLABORATEURS"
- bullets : 2 faits de crédibilité. Ex: "Déployé sans RSSI dédié.", "Configuré en 45 minutes."

### Slide 7 — cta (appel à l'action)
- tag.icon : →
- headline : "Testez [action concrète] cette semaine." ou similaire
- accentPhrase : le mot d'urgence. Ex: "cette semaine.", "maintenant.", "aujourd'hui."
- offer : l'offre gratuite ou d'entrée. 1-2 phrases max.
- button : "0FLAW.FR →" (toujours ce format)
- credibility : ligne de réassurance technique. Ex: "Setup en 45 min · Résultats en 24h · Aucune infra requise."

Réponds UNIQUEMENT avec du JSON valide. Aucun texte avant ou après.`

export async function generateCarouselSlides(
  title: string,
  topic: string
): Promise<Slide[]> {
  const userPrompt = `Carrousel LinkedIn 7 slides sur :
Titre : "${title}"
Angle/contexte : "${topic}"

Génère le JSON complet avec les 7 slides dans l'ordre : cover → problem → stat → insight → system → proof → cta.

Format attendu :
{
  "slides": [
    { "type": "cover", "tag": {"icon": "🔒", "label": "SENSIBILISATION [SUJET]", "color": "white"}, "headline": "...", "accentPhrase": "...", "body": "..." },
    { "type": "problem", "tag": {"icon": "△", "label": "PROBLÈME", "color": "red"}, "headline": "...", "accentPhrase": "...", "bullets": ["...", "...", "..."] },
    { "type": "stat", "tag": {"icon": "€", "label": "COÛT RÉEL", "color": "red"}, "stat": "...", "statLabel": "...", "body": "..." },
    { "type": "insight", "tag": {"icon": "→", "label": "DÉCLIC", "color": "accent"}, "icon": "💡", "headline": "...", "accentPhrase": "...", "body": "..." },
    { "type": "system", "tag": {"icon": "○", "label": "SYSTÈME 0FLAW", "color": "accent"}, "headline": "...", "steps": [{"num":1,"text":"...","timing":"..."},{"num":2,"text":"...","timing":"..."},{"num":3,"text":"...","timing":"..."},{"num":4,"text":"...","timing":"..."}] },
    { "type": "proof", "tag": {"icon": "→", "label": "RÉSULTATS MESURÉS", "color": "green"}, "stat": "...", "quote": "...", "source": "...", "bullets": ["...", "..."] },
    { "type": "cta", "tag": {"icon": "→", "label": "PASSEZ À L'ACTION", "color": "accent"}, "headline": "...", "accentPhrase": "...", "offer": "...", "button": "0FLAW.FR →", "credibility": "..." }
  ]
}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY!}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 3000,
      temperature: 0.72,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userPrompt },
      ],
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    const msg = data?.error?.message ?? `HTTP ${res.status}`
    throw new Error(`OpenAI API error (carousel): ${msg}`)
  }

  const raw: string = data.choices?.[0]?.message?.content ?? ''

  let parsed: { slides: Slide[] }
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Fallback: extract first JSON block if model added text around it
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error(`Réponse GPT-4o non-JSON — reçu : ${raw.slice(0, 200)}`)
    parsed = JSON.parse(match[0])
  }

  if (!Array.isArray(parsed.slides) || parsed.slides.length !== 7) {
    throw new Error(`GPT-4o a retourné ${parsed.slides?.length ?? 0} slides (attendu : 7)`)
  }

  return parsed.slides
}
