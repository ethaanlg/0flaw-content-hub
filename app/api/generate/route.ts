import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { generatePostDescription } from '@/lib/claude'
import { generateCarouselSlides } from '@/lib/slides-gen'
import { generateTextPost } from '@/lib/text-post-gen'
import { GenerateBodySchema, parseBody } from '@/lib/zod-schemas'

export async function POST(req: NextRequest) {
  // Auth guard — protège les appels Claude contre les abus
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  try {
    const parsed = parseBody(GenerateBodySchema, await req.json())
    if (!parsed.success) return parsed.response

    const { topic, title, content_type } = parsed.data
    const effectiveTitle = (title ?? topic).trim()

    if (content_type === 'text') {
      const textPost = await generateTextPost(effectiveTitle, topic.trim())
      return NextResponse.json({ content_type: 'text', ...textPost })
    }

    // carousel (default)
    const [v1, v2, v3, slides] = await Promise.all([
      generatePostDescription(topic.trim(), 'v1'),
      generatePostDescription(topic.trim(), 'v2'),
      generatePostDescription(topic.trim(), 'v3'),
      generateCarouselSlides(effectiveTitle, topic.trim()),
    ])

    return NextResponse.json({ content_type: 'carousel', v1, v2, v3, slides })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[/api/generate] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
