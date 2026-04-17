import type Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const agentTools: Anthropic.Tool[] = [
  {
    name: 'analyze_performance',
    description: 'Analyse les posts des N derniers jours et retourne les patterns gagnants',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: { type: 'number', description: 'Nombre de jours (défaut: 30)' },
        user_id: { type: 'string' }
      },
      required: ['user_id']
    }
  },
  {
    name: 'propose_content_calendar',
    description: 'Génère un plan éditorial pour les N prochaines semaines',
    input_schema: {
      type: 'object' as const,
      properties: {
        weeks: { type: 'number' },
        user_id: { type: 'string' }
      },
      required: ['user_id']
    }
  },
  {
    name: 'draft_post',
    description: 'Génère un post prêt à valider pour une plateforme donnée',
    input_schema: {
      type: 'object' as const,
      properties: {
        brief: { type: 'string' },
        platform: { type: 'string', enum: ['linkedin', 'instagram', 'x', 'threads'] },
        content_type: { type: 'string', enum: ['text', 'carousel', 'thread'] }
      },
      required: ['brief', 'platform', 'content_type']
    }
  },
  {
    name: 'save_proposal',
    description: 'Sauvegarde une proposition dans agent_proposals pour review humaine',
    input_schema: {
      type: 'object' as const,
      properties: {
        user_id: { type: 'string' },
        proposal_type: { type: 'string', enum: ['post', 'thread', 'carousel', 'newsletter', 'repost'] },
        platform: { type: 'array', items: { type: 'string' } },
        title: { type: 'string' },
        content: { type: 'object', additionalProperties: true },
        justification: { type: 'string' },
        optimal_publish_at: { type: 'string' }
      },
      required: ['user_id', 'proposal_type', 'title', 'content']
    }
  }
]

export async function executeAgentTool(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<string> {
  if (toolName === 'analyze_performance') {
    const days = (toolInput.days as number) ?? 30
    const userId = toolInput.user_id as string
    const since = new Date(Date.now() - days * 86400000).toISOString()

    // Query post_publications for user's posts
    const { data: posts } = await supabaseAdmin
      .from('posts')
      .select('id, title, topic, content_type')
      .eq('user_id', userId)

    if (!posts?.length) return JSON.stringify({ message: 'Pas de posts sur cette période', posts: 0 })

    const postIds = posts.map(p => p.id)
    const { data: pubs } = await supabaseAdmin
      .from('post_publications')
      .select('post_id, platform, published_at, analytics:post_analytics(engagement_rate, impressions, likes)')
      .in('post_id', postIds)
      .gte('published_at', since)
      .eq('status', 'success')

    if (!pubs?.length) return JSON.stringify({ message: 'Pas de publications sur cette période', posts: 0 })

    // Group by platform
    const byPlatform = pubs.reduce((acc, pub) => {
      if (!acc[pub.platform]) acc[pub.platform] = { count: 0, total_engagement: 0 }
      const analytics = Array.isArray(pub.analytics) ? pub.analytics[0] : pub.analytics
      acc[pub.platform].count++
      acc[pub.platform].total_engagement += analytics?.engagement_rate ?? 0
      return acc
    }, {} as Record<string, { count: number; total_engagement: number }>)

    const summary = Object.entries(byPlatform).map(([platform, stats]) => ({
      platform,
      posts: stats.count,
      avg_engagement: stats.count > 0 ? +(stats.total_engagement / stats.count).toFixed(2) : 0
    }))

    return JSON.stringify({ period_days: days, total_posts: pubs.length, by_platform: summary })
  }

  if (toolName === 'save_proposal') {
    const { error } = await supabaseAdmin.from('agent_proposals').insert({
      user_id: toolInput.user_id,
      proposal_type: toolInput.proposal_type,
      platform: toolInput.platform,
      title: toolInput.title,
      content: toolInput.content,
      justification: toolInput.justification ?? null,
      optimal_publish_at: toolInput.optimal_publish_at ?? null,
    })
    if (error) return JSON.stringify({ error: error.message })
    return JSON.stringify({ saved: true })
  }

  if (toolName === 'draft_post') {
    const AnthropicClient = (await import('@anthropic-ai/sdk')).default
    const client = new AnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `Rédige un ${toolInput.content_type} pour ${toolInput.platform} sur : ${toolInput.brief}. Voix 0Flaw: B2B cybersécurité FR, direct, chiffres sourcés ANSSI/IBM. Max 400 mots.`
      }]
    })
    const text = response.content.find(b => b.type === 'text')?.text ?? ''
    return JSON.stringify({ draft: text })
  }

  if (toolName === 'propose_content_calendar') {
    return JSON.stringify({ message: 'Use analyze_performance first to get data, then I will propose a calendar based on the results.' })
  }

  return JSON.stringify({ error: `Unknown tool: ${toolName}` })
}
