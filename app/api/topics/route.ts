import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { TopicCreateSchema, parseBody } from '@/lib/zod-schemas'
import type { CuratedTopic } from '@/lib/types'

// Curated topics — static list, no DB
const CURATED_TOPICS: CuratedTopic[] = [
  { id: 'phishing-pme', title: 'Phishing PME', description: 'Spear-phishing, usurpation fournisseurs, détection', category: 'menaces' },
  { id: 'ransomware', title: 'Ransomware', description: 'Vecteurs d\'entrée, coût moyen, prévention', category: 'menaces' },
  { id: 'shadow-it', title: 'Shadow IT', description: 'Outils non-autorisés, risque réseau', category: 'menaces' },
  { id: 'mots-de-passe', title: 'Mots de passe faibles', description: 'Credential stuffing, politiques MDP', category: 'menaces' },
  { id: 'nis2', title: 'NIS2', description: 'Directive NIS2 : obligations et calendrier', category: 'conformite' },
  { id: 'dora', title: 'DORA', description: 'Résilience opérationnelle secteur financier', category: 'conformite' },
  { id: 'iso27001', title: 'ISO 27001', description: 'Certification SMSI : par où commencer', category: 'conformite' },
  { id: 'rgpd', title: 'RGPD & cybersécurité', description: 'Obligations PME, notification de violation', category: 'conformite' },
  { id: 'simulation-phishing', title: 'Simulation phishing', description: 'Tester ses équipes, mesurer la résistance', category: 'sensibilisation' },
  { id: 'formation-awareness', title: 'Campagne awareness', description: 'Rendre la formation engageante', category: 'sensibilisation' },
  { id: 'mfa', title: 'Double authentification', description: 'MFA : bénéfices et mise en place rapide', category: 'sensibilisation' },
]

function createSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (newCookies) =>
          newCookies.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  )
}

// GET /api/topics — returns { curated, user }
export async function GET() {
  try {
    const supabase = createSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data, error } = await supabase
      .from('user_topics')
      .select('id, title, description, category, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ curated: CURATED_TOPICS, user: data ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[/api/topics GET] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/topics — create user topic
export async function POST(req: NextRequest) {
  try {
    const parsed = parseBody(TopicCreateSchema, await req.json())
    if (!parsed.success) return parsed.response

    const supabase = createSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data, error } = await supabase
      .from('user_topics')
      .insert({
        user_id: user.id,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        category: parsed.data.category,
      })
      .select('id, title, description, category, created_at')
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[/api/topics POST] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/topics?id=<uuid>
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: 'id invalide' }, { status: 400 })
    }

    const supabase = createSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data, error } = await supabase
      .from('user_topics')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id')

    if (error) throw error
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Topic introuvable' }, { status: 404 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[/api/topics DELETE] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
