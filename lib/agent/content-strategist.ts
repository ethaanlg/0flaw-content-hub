import Anthropic from '@anthropic-ai/sdk'
import { agentTools, executeAgentTool } from './tools'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const AGENT_SYSTEM = `Tu es l'agent IA content strategist de 0Flaw. Tu analyses les performances passées et proposes du contenu cybersécurité B2B pour PME/ETI françaises.

Comportement :
- Utilise toujours analyze_performance avant de proposer du contenu
- Justifie chaque proposition avec des données de perf concrètes
- Cible : RSSI/DSI PME françaises
- Utilise save_proposal pour chaque contenu proposé — max 7 propositions par run
- Voix 0Flaw : direct, technique, sourcé (ANSSI, Verizon DBIR, IBM), sans bullshit`

export async function runAgentWeeklyPlan(userId: string): Promise<{ proposals: number }> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Plan the week for user ${userId}. First analyze their last 30 days of performance with analyze_performance, then propose 5-7 posts for this week across LinkedIn and Instagram. For each proposal: include a title, content (as JSON with a "text" field), justification based on the performance data, and an optimal_publish_at ISO datetime. Save each proposal with save_proposal.`
    }
  ]

  let loopCount = 0
  let proposalsSaved = 0

  while (loopCount < 10) {
    loopCount++

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: AGENT_SYSTEM,
      tools: agentTools,
      messages,
    })

    if (response.stop_reason === 'end_turn') break

    if (response.stop_reason === 'tool_use') {
      const toolUses = response.content.filter(b => b.type === 'tool_use')
      messages.push({ role: 'assistant', content: response.content })

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of toolUses) {
        if (block.type !== 'tool_use') continue
        const result = await executeAgentTool(block.name, block.input as Record<string, unknown>)
        if (block.name === 'save_proposal') proposalsSaved++
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        })
      }
      messages.push({ role: 'user', content: toolResults })
    } else {
      break
    }
  }

  return { proposals: proposalsSaved }
}
