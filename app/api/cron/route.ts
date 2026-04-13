import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { publishLinkedInPost } from '@/lib/linkedin'
import { publishInstagramCarousel } from '@/lib/instagram'
import { getLinkedInPostStats } from '@/lib/linkedin'
import { getInstagramPostStats } from '@/lib/instagram'

// Vercel Cron — tourne toutes les 15 minutes
// Sécurisé par CRON_SECRET dans vercel.json
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const windowStart = new Date(now.getTime() - 15 * 60 * 1000)

  // 1. Publier les posts programmés dans la fenêtre courante
  const { data: toPublish } = await supabaseAdmin
    .from('posts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now.toISOString())
    .gte('scheduled_at', windowStart.toISOString())

  const publishResults = []
  for (const post of toPublish || []) {
    const results: Record<string, string> = {}

    if (post.platforms.includes('linkedin') && post.pdf_url) {
      try {
        const id = await publishLinkedInPost(post.description || post.title, post.pdf_url, post.title)
        results.linkedin_post_id = id
      } catch (e) { console.error('LI publish error:', e) }
    }

    if (post.platforms.includes('instagram') && post.slides_urls?.length) {
      try {
        const id = await publishInstagramCarousel(post.description || post.title, post.slides_urls)
        results.instagram_post_id = id
      } catch (e) { console.error('IG publish error:', e) }
    }

    if (Object.keys(results).length > 0) {
      await supabaseAdmin.from('posts').update({
        ...results,
        status: 'published',
        published_at: now.toISOString()
      }).eq('id', post.id)
      publishResults.push({ id: post.id, ...results })
    }
  }

  // 2. Collecter les stats des posts publiés il y a ~24h et ~7j
  const targets = [
    { hours: 24, label: '24h' },
    { hours: 168, label: '7j' }
  ]

  const statsResults = []
  for (const target of targets) {
    const targetTime = new Date(now.getTime() - target.hours * 60 * 60 * 1000)
    const window15 = new Date(targetTime.getTime() - 15 * 60 * 1000)

    const { data: postsToTrack } = await supabaseAdmin
      .from('posts')
      .select('*')
      .eq('status', 'published')
      .lte('published_at', targetTime.toISOString())
      .gte('published_at', window15.toISOString())

    for (const post of postsToTrack || []) {
      if (post.linkedin_post_id) {
        try {
          const stats = await getLinkedInPostStats(post.linkedin_post_id)
          await supabaseAdmin.from('post_stats').insert({ post_id: post.id, platform: 'linkedin', ...stats })
          statsResults.push({ id: post.id, platform: 'linkedin', window: target.label })
        } catch (e) { console.error('LI stats error:', e) }
      }
      if (post.instagram_post_id) {
        try {
          const stats = await getInstagramPostStats(post.instagram_post_id)
          await supabaseAdmin.from('post_stats').insert({ post_id: post.id, platform: 'instagram', ...stats })
          statsResults.push({ id: post.id, platform: 'instagram', window: target.label })
        } catch (e) { console.error('IG stats error:', e) }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    published: publishResults.length,
    stats_collected: statsResults.length,
    timestamp: now.toISOString()
  })
}
