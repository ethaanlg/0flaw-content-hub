import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdapter } from '@/lib/platforms'
import type { Platform, PostContent, OAuthTokens } from '@/lib/platforms'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Auth check via CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date().toISOString()

  // Fetch due scheduled posts
  const { data: posts, error: fetchError } = await supabaseAdmin
    .from('posts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .limit(10)

  if (fetchError) {
    console.error('[publish-scheduled] fetch error:', fetchError.message)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const results: Array<{ postId: string; platforms: Record<string, string> }> = []
  let processed = 0

  for (const post of posts ?? []) {
    // Mark as 'publishing' immediately to prevent double-processing
    const { error: lockError } = await supabaseAdmin
      .from('posts')
      .update({ status: 'publishing' })
      .eq('id', post.id)
      .eq('status', 'scheduled') // guard: only update if still scheduled

    if (lockError) {
      console.error(`[publish-scheduled] lock error for post ${post.id}:`, lockError.message)
      continue
    }

    const platforms: Platform[] = Array.isArray(post.platforms) ? post.platforms : []
    const platformResults: Record<string, string> = {}
    let anyFailed = false

    // Build PostContent from post data
    const content: PostContent = {
      text: post.payload?.text ?? post.linkedin_text ?? post.instagram_text ?? '',
      mediaUrls: post.payload?.media_urls ?? [],
      pdfUrl: post.payload?.pdf_url,
      contentType: post.content_type as PostContent['contentType'],
    }

    for (const platform of platforms) {
      // Fetch platform connection (tokens) for this user + platform
      const { data: connection, error: connError } = await supabaseAdmin
        .from('platform_connections')
        .select('*')
        .eq('user_id', post.user_id)
        .eq('platform', platform)
        .single()

      if (connError || !connection) {
        const errMsg = connError?.message ?? 'Connexion plateforme introuvable'
        console.error(`[publish-scheduled] no connection for ${platform} / user ${post.user_id}:`, errMsg)

        const { error: pubInsertError } = await supabaseAdmin.from('post_publications').insert({
          post_id: post.id,
          platform,
          status: 'failed',
          error_message: errMsg,
        })

        if (pubInsertError) {
          console.error(`[publish-cron] Failed to insert post_publication for ${post.id}/${platform}:`, pubInsertError.message)
        }

        platformResults[platform] = 'failed'
        anyFailed = true
        continue
      }

      const tokens: OAuthTokens = {
        accessToken: connection.access_token,
        refreshToken: connection.refresh_token ?? undefined,
        expiresAt: connection.expires_at ? new Date(connection.expires_at) : undefined,
        scopes: connection.scopes ?? undefined,
      }

      try {
        const adapter = getAdapter(platform)
        const result = await adapter.publish(content, tokens)

        const { error: pubInsertError } = await supabaseAdmin.from('post_publications').insert({
          post_id: post.id,
          platform,
          external_id: result.externalId ?? null,
          published_at: result.success ? new Date().toISOString() : null,
          status: result.success ? 'success' : 'failed',
          error_message: result.error ?? null,
        })

        if (pubInsertError) {
          console.error(`[publish-cron] Failed to insert post_publication for ${post.id}/${platform}:`, pubInsertError.message)
        }

        platformResults[platform] = result.success ? 'success' : 'failed'
        if (!result.success) anyFailed = true
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue'
        console.error(`[publish-scheduled] publish error for ${platform}:`, message)

        const { error: pubInsertError } = await supabaseAdmin.from('post_publications').insert({
          post_id: post.id,
          platform,
          status: 'failed',
          error_message: message,
        })

        if (pubInsertError) {
          console.error(`[publish-cron] Failed to insert post_publication for ${post.id}/${platform}:`, pubInsertError.message)
        }

        platformResults[platform] = 'failed'
        anyFailed = true
      }
    }

    // Update post final status
    const { error: finalUpdateError } = await supabaseAdmin
      .from('posts')
      .update({
        status: anyFailed ? 'failed' : 'published',
        published_at: anyFailed ? null : new Date().toISOString(),
      })
      .eq('id', post.id)

    if (finalUpdateError) {
      console.error(`[publish-cron] Failed to update final status for post ${post.id}:`, finalUpdateError.message)
      // Reset to 'scheduled' so the post can be retried on the next cron run
      await supabaseAdmin
        .from('posts')
        .update({ status: 'scheduled' })
        .eq('id', post.id)
    }

    results.push({ postId: post.id, platforms: platformResults })
    processed++
  }

  return NextResponse.json({ ok: true, processed, results })
}
