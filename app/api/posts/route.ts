import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET /api/posts?from=2024-01-01&to=2024-01-31&status=scheduled&platform=linkedin
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

// POST /api/posts — update status and/or scheduledAt
// body: { id: string, status?: string, scheduledAt?: string }
export async function POST(req: NextRequest) {
  try {
    const { id, status, scheduledAt } = await req.json()
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (status !== undefined) {
      const valid = ['draft', 'scheduled', 'published', 'failed']
      if (!valid.includes(status)) {
        return NextResponse.json({ error: `status invalide. Valeurs acceptées: ${valid.join(', ')}` }, { status: 400 })
      }
      updates.status = status
    }

    if (scheduledAt !== undefined) {
      updates.scheduled_at = scheduledAt ? new Date(scheduledAt).toISOString() : null
      // Auto-set status to scheduled when a date is provided
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
