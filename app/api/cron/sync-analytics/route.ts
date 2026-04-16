// app/api/cron/sync-analytics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdapter } from '@/lib/platforms'
import type { Platform } from '@/lib/platforms'

export const maxDuration = 300

export async function GET(req: NextRequest) {
  // 1. Check Authorization header == `Bearer ${CRON_SECRET}`
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Admin Supabase client is already created at import time
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // 3. Query post_publications: success, last 30 days, external_id not null, limit 100
  const { data: publications, error: pubError } = await supabaseAdmin
    .from('post_publications')
    .select('id, platform, external_id, post_id')
    .eq('status', 'success')
    .gte('published_at', thirtyDaysAgo)
    .not('external_id', 'is', null)
    .limit(100)

  if (pubError) {
    console.error('[sync-analytics] fetch publications error:', pubError.message)
    return NextResponse.json({ error: pubError.message }, { status: 500 })
  }

  let synced = 0

  // 4. For each publication, fetch analytics and store snapshot
  for (const pub of publications ?? []) {
    // a. Get user_id from posts
    const { data: post, error: postError } = await supabaseAdmin
      .from('posts')
      .select('user_id')
      .eq('id', pub.post_id)
      .single()

    if (postError || !post) {
      console.error(`[sync-analytics] could not fetch post ${pub.post_id}:`, postError?.message)
      continue
    }

    // b. Get platform connection (access_token, refresh_token)
    const { data: connection, error: connError } = await supabaseAdmin
      .from('platform_connections')
      .select('access_token, refresh_token')
      .eq('user_id', post.user_id)
      .eq('platform', pub.platform)
      .single()

    // c. If no connection found, skip
    if (connError || !connection) {
      console.warn(`[sync-analytics] no connection for user ${post.user_id} / ${pub.platform}`)
      continue
    }

    // d. Call adapter.getAnalytics — wrap in try/catch
    try {
      const adapter = getAdapter(pub.platform as Platform)
      const analytics = await adapter.getAnalytics(pub.external_id as string, {
        accessToken: connection.access_token,
        refreshToken: connection.refresh_token ?? undefined,
      })

      // e. Insert snapshot into post_analytics
      const { error: insertError } = await supabaseAdmin
        .from('post_analytics')
        .insert({
          publication_id: pub.id,
          impressions: analytics.impressions,
          reach: analytics.reach,
          likes: analytics.likes,
          comments: analytics.comments,
          shares: analytics.shares,
          saves: analytics.saves,
          clicks: analytics.clicks,
          video_views: analytics.videoViews ?? 0,
          engagement_rate: analytics.engagementRate,
          snapshot_at: new Date().toISOString(),
        })

      if (insertError) {
        console.error(`[sync-analytics] insert error for pub ${pub.id}:`, insertError.message)
        continue
      }

      // f. Update analytics_last_sync on post_publications
      const { error: updateError } = await supabaseAdmin
        .from('post_publications')
        .update({ analytics_last_sync: new Date().toISOString() })
        .eq('id', pub.id)

      if (updateError) {
        console.error(`[sync-analytics] update analytics_last_sync error for pub ${pub.id}:`, updateError.message)
      }

      // g. Increment synced counter
      synced++
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[sync-analytics] getAnalytics failed for pub ${pub.id}:`, message)
      continue
    }
  }

  // 5. Return result
  return NextResponse.json({ ok: true, synced })
}
