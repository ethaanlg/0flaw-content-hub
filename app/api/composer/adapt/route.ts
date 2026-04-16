import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const anthropic = new Anthropic()

type Platform = 'linkedin' | 'instagram' | 'x' | 'threads'

const PLATFORM_DESCRIPTIONS: Record<Platform, string> = {
  linkedin: 'Version LinkedIn: ton pro, 200-400 mots, hashtags',
  instagram: 'Version Instagram: condensée, 150 mots max, emojis, hashtags',
  x: 'Version X: punchy, 280 chars max, 1-2 hashtags',
  threads: 'Version Threads: casual, 500 chars max',
}

function createUserClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (newCookies) =>
          newCookies.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  )
}

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const userClient = createUserClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Parse body
    const body = await req.json()
    const { text, platforms } = body

    // Validate inputs
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return NextResponse.json({ error: 'text est requis et doit être une chaîne non vide' }, { status: 400 })
    }
    if (!Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json({ error: 'platforms est requis et doit être un tableau non vide' }, { status: 400 })
    }

    const requestedPlatforms = platforms.filter((p): p is Platform =>
      ['linkedin', 'instagram', 'x', 'threads'].includes(p)
    )
    if (requestedPlatforms.length === 0) {
      return NextResponse.json({ error: 'Aucune plateforme valide fournie' }, { status: 400 })
    }

    // Build tool schema — only require the requested platforms
    const properties: Record<string, { type: string; description: string }> = {}
    for (const platform of requestedPlatforms) {
      properties[platform] = {
        type: 'string',
        description: PLATFORM_DESCRIPTIONS[platform],
      }
    }

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      system:
        'Tu es le copywriter de 0Flaw, marque B2B cybersécurité française. ' +
        'Tu rédiges du contenu percutant pour les RSSI et DSI. ' +
        'Ton style : direct, expert, sans jargon inutile, voix de praticien terrain. ' +
        'Tu adaptes le même message clé selon les codes de chaque plateforme.',
      messages: [
        {
          role: 'user',
          content:
            `Adapte ce contenu pour les plateformes suivantes : ${requestedPlatforms.join(', ')}.\n\n` +
            `Contenu source :\n${text.trim()}\n\n` +
            `Utilise l'outil adapt_content pour retourner les versions adaptées.`,
        },
      ],
      tools: [
        {
          name: 'adapt_content',
          description: 'Retourne le contenu adapté pour chaque plateforme demandée',
          input_schema: {
            type: 'object' as const,
            properties,
            required: requestedPlatforms,
          },
        },
      ],
      tool_choice: { type: 'any' },
    })

    // Extract tool use result
    const toolUse = response.content.find((block) => block.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return NextResponse.json({ error: 'Claude n\'a pas retourné de contenu adapté' }, { status: 500 })
    }

    const adapted = toolUse.input as Partial<Record<Platform, string>>

    return NextResponse.json({ adapted })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[/api/composer/adapt] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
