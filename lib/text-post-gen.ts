// Claude text post generation — LinkedIn full post + Instagram caption
import Anthropic from '@anthropic-ai/sdk'
import { cachedOr } from './kv-cache'
import type { TextPost } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

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

Utilise l'outil 'generate_text_post' pour retourner tes réponses.`

export async function generateTextPost(
  title: string,
  topic: string
): Promise<TextPost> {
  const topicSlug = topic.toLowerCase().trim().replace(/\s+/g, '-').slice(0, 60)
  const titleSlug = title.toLowerCase().trim().replace(/\s+/g, '-').slice(0, 40)
  const cacheKey = `text-post:${topicSlug}:${titleSlug}`

  return cachedOr(cacheKey, async () => {
    const userPrompt = `Rédige un post LinkedIn + caption Instagram sur :
Titre : "${title}"
Angle/contexte : "${topic}"`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: 'generate_text_post',
          description: 'Génère un post LinkedIn et une caption Instagram',
          input_schema: {
            type: 'object' as const,
            properties: {
              linkedin: {
                type: 'string',
                description: 'Post LinkedIn complet avec hook, corps, CTA et hashtags'
              },
              instagram: {
                type: 'string',
                description: 'Caption Instagram condensée avec emojis et hashtags'
              }
            },
            required: ['linkedin', 'instagram']
          }
        }
      ],
      tool_choice: { type: 'tool', name: 'generate_text_post' },
      messages: [{ role: 'user', content: userPrompt }]
    })

    const toolBlock = response.content.find(b => b.type === 'tool_use')
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      throw new Error('Claude: no tool_use block in text-post response')
    }

    const parsed = toolBlock.input as TextPost

    if (!parsed.linkedin?.trim() || !parsed.instagram?.trim()) {
      throw new Error('Claude: champs linkedin ou instagram manquants')
    }

    return parsed
  })
}
