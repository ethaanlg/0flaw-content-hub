import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdapter } from '@/lib/platforms'
import type { Platform, PostContent, OAuthTokens } from '@/lib/platforms'
import { PublishBodySchema, parseBody } from '@/lib/zod-schemas'

export async function POST(req: NextRequest) {
  // Auth guard
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const parsed = parseBody(PublishBodySchema, await req.json())
  if (!parsed.success) return parsed.response

  const { postId } = parsed.data

  // Fetch post — ensure it belongs to this user
  const { data: post, error: postError } = await supabaseAdmin
    .from('posts')
    .select('*')
    .eq('id', postId)
    .eq('user_id', user.id)
    .single()

  if (postError || !post) {
    return NextResponse.json({ error: 'Post introuvable' }, { status: 404 })
  }
  if (post.status === 'published') {
    return NextResponse.json({ error: 'Déjà publié' }, { status: 409 })
  }

  const results: Record<string, string> = {}
  const errors: string[] = []
  const platforms: Platform[] = Array.isArray(post.platforms) ? post.platforms : []

  for (const platform of platforms) {
    // Load per-user tokens from platform_connections
    const { data: connection, error: connError } = await supabaseAdmin
      .from('platform_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', platform)
      .single()

    if (connError || !connection) {
      errors.push(`${platform}: connexion non trouvée — connectez votre compte dans /connections`)
      continue
    }

    const tokens: OAuthTokens = {
      accessToken: connection.access_token,
      refreshToken: connection.refresh_token ?? undefined,
      expiresAt: connection.expires_at ? new Date(connection.expires_at) : undefined,
    }

    const content: PostContent = {
      text: post.description || post.title,
      mediaUrls: post.slides_urls ?? [],
      pdfUrl: post.pdf_url ?? undefined,
      contentType: (post.content_type as PostContent['contentType']) ?? 'carousel',
    }

    try {
      const adapter = getAdapter(platform)
      const result = await adapter.publish(content, tokens)

      if (result.success && result.externalId) {
        results[`${platform}_post_id`] = result.externalId
      } else {
        errors.push(`${platform}: ${result.error ?? 'échec inconnu'}`)
      }
    } catch (e: unknown) {
      errors.push(`${platform}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const hasSuccess = Object.keys(results).length > 0

  const { error: updateError } = await supabaseAdmin
    .from('posts')
    .update({
      ...results,
      status: hasSuccess ? 'published' : 'failed',
      published_at: hasSuccess ? new Date().toISOString() : null,
    })
    .eq('id', postId)

  if (updateError) {
    console.error('[/api/publish] Failed to update post status:', updateError.message)
    return NextResponse.json(
      { error: 'Publication réussie mais mise à jour du statut échouée' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: hasSuccess, results, errors })
}
