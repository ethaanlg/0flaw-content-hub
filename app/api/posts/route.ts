import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { PostsUpdateBodySchema, parseBody } from '@/lib/zod-schemas'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const status = searchParams.get('status')
  const platform = searchParams.get('platform')

  let query = supabaseAdmin
    .from('posts')
    .select('*')
    .order('scheduled_at', { ascending: true })

  if (from) query = query.gte('scheduled_at', from)
  if (to) query = query.lte('scheduled_at', to)
  if (status) query = query.eq('status', status)
  if (platform) query = query.contains('platforms', [platform])

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data })
}

export async function POST(req: NextRequest) {
  try {
    const parsed = parseBody(PostsUpdateBodySchema, await req.json())
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
