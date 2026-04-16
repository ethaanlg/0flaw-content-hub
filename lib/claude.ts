// lib/claude.ts — Anthropic Claude description generation
import Anthropic from '@anthropic-ai/sdk'
import { cachedOr } from './kv-cache'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function generatePostDescription(
  topic: string,
  variant: 'v1' | 'v2' | 'v3' = 'v3'
): Promise<string> {
  const cacheKey = `desc:${variant}:${topic.toLowerCase().trim().replace(/\s+/g, '-').slice(0, 80)}`

  return cachedOr(cacheKey, async () => {
    const variantInstructions = {
      v1: 'V1 courte (3 lignes) : stat choc + question + hook. Commencer par le chiffre.',
      v2: 'V2 directe (4 lignes) : tension narrative + "swipe". Commencer par une affirmation.',
      v3: 'V3 maximale (5-6 lignes) : chiffre → cause → solution → CTA. La plus complète.'
    }

    const systemPrompt = `Tu es un expert copywriter LinkedIn pour 0Flaw, une plateforme SaaS de sensibilisation cybersécurité pour PME/ETI françaises.

Règles voix 0Flaw :
- Direct, technique, sans bullshit, anti-fluff
- Phrases courtes, mots simples
- Jamais "innovant", "révolutionnaire", "solution" comme adjectif vague
- Chiffres concrets (ANSSI, Verizon DBIR, IBM)
- Cible : RSSI et DSI de PME/ETI françaises, débordés, pragmatiques
- Pas de "Je" au début
- 1 seul emoji maximum
- Finir par 4-5 hashtags : #Cybersécurité + hashtags spécifiques
- Jamais d'URL dans le texte (pénalise la portée LinkedIn)
- Répondre UNIQUEMENT avec la description, sans introduction ni explication`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Sujet du carrousel : "${topic}"\n\nRédige la description LinkedIn format ${variantInstructions[variant]}`
        }
      ]
    })

    const block = response.content.find(b => b.type === 'text')
    if (!block || block.type !== 'text') {
      throw new Error('Claude: no text block in response')
    }
    return block.text
  })
}
