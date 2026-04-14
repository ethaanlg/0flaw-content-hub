import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { PostsUpdateBodySchema, PostCreateSchema, parseBody } from '@/lib/zod-schemas'

// GET /api/posts?from=...&to=...&status=...&platform=...&limit=50&cursor=<uuid>
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const status = searchParams.get('status')
    const platform = searchParams.get('platform')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)
    const cursor = searchParams.get('cursor')

    let query = supabaseAdmin
      .from('posts')
      .select('*')
      .order('scheduled_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(limit + 1) // +1 pour détecter s'il y a une page suivante

    if (from) query = query.gte('scheduled_at', from)
    if (to) query = query.lte('scheduled_at', to)
    if (status) query = query.eq('status', status)
    if (platform) query = query.contains('platforms', [platform])

    // Cursor-based pagination : reprendre après le dernier item reçu
    if (cursor) {
      const { data: cursorPost } = await supabaseAdmin
        .from('posts')
        .select('scheduled_at, id')
        .eq('id', cursor)
        .single()

      if (cursorPost?.scheduled_at) {
        query = query.or(
          `scheduled_at.gt.${cursorPost.scheduled_at},and(scheduled_at.eq.${cursorPost.scheduled_at},id.gt.${cursorPost.id})`
        )
      }
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const posts = data ?? []
    const hasMore = posts.length > limit
    const page = hasMore ? posts.slice(0, limit) : posts
    const nextCursor = hasMore ? page[page.length - 1].id : null

    return NextResponse.json({ posts: page, nextCursor, hasMore })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Branch: if body has `id`, it's an update; otherwise it's a create
    if (body.id !== undefined) {
      // Existing UPDATE path
      const parsed = parseBody(PostsUpdateBodySchema, body)
      if (!parsed.success) return parsed.response

      const { id, status, scheduledAt } = parsed.data
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

      if (status !== undefined) updates.status = status

      if (scheduledAt !== undefined) {
        updates.scheduled_at = scheduledAt ? new Date(scheduledAt).toISOString() : null
        if (scheduledAt && !updates.status) updates.status = 'scheduled'
      }

      const { data, error } = await supabaseAdmin
        .from('posts')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ post: data })
    }

    // CREATE path
    const parsed = parseBody(PostCreateSchema, body)
    if (!parsed.success) return parsed.response

    const { data, error } = await supabaseAdmin
      .from('posts')
      .insert({
        title: parsed.data.title,
        topic: parsed.data.topic ?? null,
        content_type: parsed.data.content_type,
        platforms: parsed.data.platforms,
        status: parsed.data.status,
        linkedin_text: parsed.data.linkedin_text ?? null,
        instagram_text: parsed.data.instagram_text ?? null,
        description: parsed.data.description ?? null,
        scheduled_at: parsed.data.scheduled_at ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[/api/posts POST] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
