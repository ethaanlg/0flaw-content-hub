import { NextRequest, NextResponse } from 'next/server'
import { generatePostDescription } from '@/lib/claude'
import { generateCarouselSlides } from '@/lib/slides-gen'

export async function POST(req: NextRequest) {
  try {
    const { topic, title } = await req.json()
    if (!topic || topic.trim().length < 3) {
      return NextResponse.json({ error: 'Sujet trop court (min 3 caractères)' }, { status: 400 })
    }

    const effectiveTitle = (title ?? topic).trim()

    // Generate descriptions and slides in parallel
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
