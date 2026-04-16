// Anthropic Claude carousel generation — structure based on 0Flaw reference carousel
// Each slide maps 1:1 to a visual template in the renderer
import Anthropic from '@anthropic-ai/sdk'
import { cachedOr } from './kv-cache'

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
  const cacheKey = `slides:${topic.toLowerCase().trim().replace(/\s+/g, '-').slice(0, 80)}`

  return cachedOr(cacheKey, async () => {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const userPrompt = `Carrousel LinkedIn 7 slides sur :
Titre : "${title}"
Angle/contexte : "${topic}"

Génère le JSON complet avec les 7 slides dans l'ordre : cover → problem → stat → insight → system → proof → cta.`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: 'generate_carousel',
          description: 'Génère un carrousel LinkedIn 7 slides structuré',
          input_schema: {
            type: 'object' as const,
            properties: {
              slides: {
                type: 'array',
                minItems: 7,
                maxItems: 7,
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['cover', 'problem', 'stat', 'insight', 'system', 'proof', 'cta'] }
                  },
                  required: ['type'],
                  additionalProperties: true
                }
              }
            },
            required: ['slides']
          }
        }
      ],
      tool_choice: { type: 'tool', name: 'generate_carousel' },
      messages: [{ role: 'user', content: userPrompt }]
    })

    const toolBlock = response.content.find(b => b.type === 'tool_use')
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      throw new Error('Claude: no tool_use block in carousel response')
    }

    const result = toolBlock.input as { slides: Slide[] }

    if (!Array.isArray(result.slides) || result.slides.length !== 7) {
      throw new Error(`Claude: expected 7 slides, got ${result.slides?.length ?? 0}`)
    }

    return result.slides
  })
}
