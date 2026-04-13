import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { publishLinkedInPost } from '@/lib/linkedin'
import { publishInstagramCarousel } from '@/lib/instagram'
import { getLinkedInPostStats } from '@/lib/linkedin'
import { getInstagramPostStats } from '@/lib/instagram'

// Vercel Cron — runs every 15 minutes
// Protected by CRON_SECRET (set in Vercel environment variables)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const windowStart = new Date(now.getTime() - 15 * 60 * 1000)

  // 1. Publish scheduled posts due in the current 15-min window
  const { data: toPublish } = await supabaseAdmin
    .from('posts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now.toISOString())
    .gte('scheduled_at', windowStart.toISOString())

  const publishResults: { id: string; linkedin_post_id?: string; instagram_post_id?: string }[] = []

  for (const post of toPublish || []) {
    const results: Record<string, string> = {}

    if (post.platforms.includes('linkedin')) {
      if (!post.pdf_url) {
        console.warn(`[cron] Post ${post.id} — LinkedIn ignoré : pdf_url manquant`)
      } else {
        try {
          results.linkedin_post_id = await publishLinkedInPost(
            post.description || post.title,
            post.pdf_url,
            post.title
          )
        } catch (e) {
          console.error(`[cron] LinkedIn publish error for post ${post.id}:`, e)
        }
      }
    }

    if (post.platforms.includes('instagram')) {
      if (!post.slides_urls?.length) {
        console.warn(`[cron] Post ${post.id} — Instagram ignoré : slides_urls manquant`)
      } else {
        try {
          results.instagram_post_id = await publishInstagramCarousel(
            post.description || post.title,
            post.slides_urls
          )
        } catch (e) {
          console.error(`[cron] Instagram publish error for post ${post.id}:`, e)
        }
      }
    }

    if (Object.keys(results).length > 0) {
      await supabaseAdmin
        .from('posts')
        .update({ ...results, status: 'published', published_at: now.toISOString() })
        .eq('id', post.id)
      publishResults.push({ id: post.id, ...results })
    } else {
      const reason = [
        post.platforms.includes('linkedin') && !post.pdf_url ? 'pdf_url manquant (LinkedIn)' : '',
        post.platforms.includes('instagram') && !post.slides_urls?.length ? 'slides_urls manquant (Instagram)' : '',
      ].filter(Boolean).join(', ') || 'erreur API publication'
      console.error(`[cron] Post ${post.id} marqué failed — raison : ${reason}`)
      await supabaseAdmin
        .from('posts')
        .update({ status: 'failed' })
        .eq('id', post.id)
    }
  }

  // 2. Collect stats for posts published ~24h and ~7d ago
  const statWindows = [
    { hours: 24, label: '24h' },
    { hours: 168, label: '7d' },
  ]

  const statsResults: { id: string; platform: string; window: string }[] = []

  for (const target of statWindows) {
    const targetTime = new Date(now.getTime() - target.hours * 60 * 60 * 1000)
    const windowEdge = new Date(targetTime.getTime() - 15 * 60 * 1000)

    const { data: postsToTrack } = await supabaseAdmin
      .from('posts')
      .select('*')
      .eq('status', 'published')
      .lte('published_at', targetTime.toISOString())
      .gte('published_at', windowEdge.toISOString())

    for (const post of postsToTrack || []) {
      if (post.linkedin_post_id) {
        try {
          const stats = await getLinkedInPostStats(post.linkedin_post_id)
          await supabaseAdmin
            .from('post_stats')
            .insert({ post_id: post.id, platform: 'linkedin', ...stats })
          statsResults.push({ id: post.id, platform: 'linkedin', window: target.label })
        } catch (e) {
          console.error(`[cron] LinkedIn stats error for post ${post.id}:`, e)
        }
      }

      if (post.instagram_post_id) {
        try {
          const stats = await getInstagramPostStats(post.instagram_post_id)
          await supabaseAdmin
            .from('post_stats')
            .insert({ post_id: post.id, platform: 'instagram', ...stats })
          statsResults.push({ id: post.id, platform: 'instagram', window: target.label })
        } catch (e) {
          console.error(`[cron] Instagram stats error for post ${post.id}:`, e)
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    published: publishResults.length,
    stats_collected: statsResults.length,
    timestamp: now.toISOString(),
  })
}
