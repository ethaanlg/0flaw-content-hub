import { NextRequest, NextResponse } from 'next/server'
import { generatePostDescription } from '@/lib/claude'
import { generateCarouselSlides } from '@/lib/slides-gen'
import { GenerateBodySchema, parseBody } from '@/lib/zod-schemas'

export async function POST(req: NextRequest) {
  try {
    const parsed = parseBody(GenerateBodySchema, await req.json())
    if (!parsed.success) return parsed.response

    const { topic, title } = parsed.data
    const effectiveTitle = (title ?? topic).trim()

    const [v1, v2, v3, slides] = await Promise.all([
      generatePostDescription(topic.trim(), 'v1'),
      generatePostDescription(topic.trim(), 'v2'),
      generatePostDescription(topic.trim(), 'v3'),
      generateCarouselSlides(effectiveTitle, topic.trim()),
    ])

    return NextResponse.json({ v1, v2, v3, slides })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[/api/generate] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
