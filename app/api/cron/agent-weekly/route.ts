// Runs every Monday at 8h UTC
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { runAgentWeeklyPlan } from '@/lib/agent/content-strategist'

export const maxDuration = 300

export async function GET(req: Request) {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()

  const results: { userId: string; proposals?: number; error?: string }[] = []

  for (const user of users) {
    try {
      const result = await runAgentWeeklyPlan(user.id)
      results.push({ userId: user.id, proposals: result.proposals })
    } catch (e) {
      results.push({ userId: user.id, error: (e as Error).message })
    }
  }

  return NextResponse.json({ ok: true, results })
}
