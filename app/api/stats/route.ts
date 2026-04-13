import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getLinkedInPostStats } from '@/lib/linkedin'
import { getInstagramPostStats } from '@/lib/instagram'
import { StatsBodySchema, parseBody } from '@/lib/zod-schemas'

export async function POST(req: NextRequest) {
  try {
    const parsed = parseBody(StatsBodySchema, await req.json())
    if (!parsed.success) return parsed.response

    const { postId } = parsed.data

    const { data: post } = await supabaseAdmin
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single()

    if (!post) return NextResponse.json({ error: 'Post introuvable' }, { status: 404 })

    const collected = []

    if (post.linkedin_post_id) {
      const stats = await getLinkedInPostStats(post.linkedin_post_id)
      const { data } = await supabaseAdmin.from('post_stats').insert({
        post_id: postId,
        platform: 'linkedin',
        ...stats
      }).select().single()
      collected.push(data)
    }

    if (post.instagram_post_id) {
      const stats = await getInstagramPostStats(post.instagram_post_id)
      const { data } = await supabaseAdmin.from('post_stats').insert({
        post_id: postId,
        platform: 'instagram',
        ...stats
      }).select().single()
      collected.push(data)
    }

    return NextResponse.json({ collected })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// GET /api/stats — aggregated totals per platform + best publishing hours
export async function GET(_req: NextRequest) {
  const [{ data: allStats, error: statsError }, { data: publishedPosts, error: postsError }] =
    await Promise.all([
      supabaseAdmin
        .from('post_stats')
        .select('post_id, platform, impressions, reach, likes, comments, shares, saves, clicks, engagement_rate'),
      supabaseAdmin
        .from('posts')
        .select('id, published_at')
        .eq('status', 'published')
        .not('published_at', 'is', null),
    ])

  if (statsError) return NextResponse.json({ error: statsError.message }, { status: 500 })
  if (postsError) return NextResponse.json({ error: postsError.message }, { status: 500 })

  // Aggregate totals per platform
  const aggregated: Record<string, {
    impressions: number; reach: number; likes: number; comments: number
    shares: number; saves: number; clicks: number; avg_engagement_rate: number; count: number
  }> = {}

  for (const stat of allStats || []) {
    if (!aggregated[stat.platform]) {
      aggregated[stat.platform] = { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, avg_engagement_rate: 0, count: 0 }
    }
    const a = aggregated[stat.platform]
    a.impressions += stat.impressions
    a.reach += stat.reach
    a.likes += stat.likes
    a.comments += stat.comments
    a.shares += stat.shares
    a.saves += stat.saves
    a.clicks += stat.clicks
    a.avg_engagement_rate += stat.engagement_rate
    a.count++
  }
  for (const platform of Object.keys(aggregated)) {
    const a = aggregated[platform]
    a.avg_engagement_rate = a.count
      ? parseFloat((a.avg_engagement_rate / a.count).toFixed(2))
      : 0
  }

  // Best hours: map post_id → UTC hour of publication
  const postHourMap: Record<string, number> = {}
  for (const post of publishedPosts || []) {
    postHourMap[post.id] = new Date(post.published_at).getUTCHours()
  }

  const hourBuckets: Record<number, { total: number; count: number }> = {}
  for (const stat of allStats || []) {
    const hour = postHourMap[stat.post_id]
    if (hour === undefined) continue
    if (!hourBuckets[hour]) hourBuckets[hour] = { total: 0, count: 0 }
    hourBuckets[hour].total += stat.engagement_rate
    hourBuckets[hour].count++
  }

  const bestHours = Object.entries(hourBuckets)
    .map(([hour, { total, count }]) => ({
      hour: parseInt(hour),
      avg_engagement_rate: parseFloat((total / count).toFixed(2)),
      sample_count: count,
    }))
    .sort((a, b) => b.avg_engagement_rate - a.avg_engagement_rate)

  return NextResponse.json({ aggregated, bestHours })
}
