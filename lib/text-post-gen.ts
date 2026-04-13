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
