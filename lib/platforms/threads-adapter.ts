import type { PlatformAdapter, PostContent, OAuthTokens, PublishResult, PostAnalytics } from './types'

const THREADS_BASE = 'https://graph.threads.net/v1.0'

export const threadsAdapter: PlatformAdapter = {
  platform: 'threads',

  async publish(content: PostContent, tokens: OAuthTokens): Promise<PublishResult> {
    try {
      const accountId = process.env.THREADS_ACCOUNT_ID!
      const accessToken = tokens.accessToken

      if (content.contentType === 'carousel' && (content.mediaUrls?.length ?? 0) > 1) {
        // Step 1: create carousel item containers
        const childIds: string[] = []
        for (const url of content.mediaUrls!) {
          const res = await fetch(`${THREADS_BASE}/${accountId}/threads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              media_type: 'IMAGE',
              image_url: url,
              is_carousel_item: true,
              access_token: accessToken,
            }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(`Threads carousel item failed: ${data.error?.message ?? JSON.stringify(data)}`)
          childIds.push(data.id as string)
        }

        // Step 2: create carousel container
        const carouselRes = await fetch(`${THREADS_BASE}/${accountId}/threads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            media_type: 'CAROUSEL',
            children: childIds.join(','),
            text: content.text.slice(0, 500),
            access_token: accessToken,
          }),
        })
        const carouselData = await carouselRes.json()
        if (!carouselRes.ok) throw new Error(`Threads carousel container failed: ${carouselData.error?.message ?? JSON.stringify(carouselData)}`)
        const containerId = carouselData.id as string

        // Step 3: publish
        const publishRes = await fetch(`${THREADS_BASE}/${accountId}/threads_publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
        })
        const publishData = await publishRes.json()
        if (!publishRes.ok) throw new Error(`Threads publish failed: ${publishData.error?.message ?? JSON.stringify(publishData)}`)

        return { success: true, externalId: publishData.id as string }
      } else {
        // Text post
        const containerRes = await fetch(`${THREADS_BASE}/${accountId}/threads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            media_type: 'TEXT',
            text: content.text.slice(0, 500),
            access_token: accessToken,
          }),
        })
        const containerData = await containerRes.json()
        if (!containerRes.ok) throw new Error(`Threads text container failed: ${containerData.error?.message ?? JSON.stringify(containerData)}`)

        const publishRes = await fetch(`${THREADS_BASE}/${accountId}/threads_publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creation_id: containerData.id, access_token: accessToken }),
        })
        const publishData = await publishRes.json()
        if (!publishRes.ok) throw new Error(`Threads publish failed: ${publishData.error?.message ?? JSON.stringify(publishData)}`)

        return { success: true, externalId: publishData.id as string }
      }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },

  async getAnalytics(externalId: string, tokens: OAuthTokens): Promise<PostAnalytics> {
    const res = await fetch(
      `${THREADS_BASE}/${externalId}/insights?metric=views,likes,replies,reposts,quotes&access_token=${tokens.accessToken}`
    )
    const body = await res.json()
    if (!res.ok) throw new Error(`Threads analytics failed: ${body.error?.message ?? JSON.stringify(body)}`)

    const metrics: Record<string, number> = {}
    for (const item of (body.data as Array<{ name: string; values: Array<{ value: number }> }>)) {
      metrics[item.name] = item.values[0]?.value ?? 0
    }

    const views = metrics['views'] ?? 0
    const likes = metrics['likes'] ?? 0
    const replies = metrics['replies'] ?? 0
    const reposts = metrics['reposts'] ?? 0

    return {
      postId: externalId,
      externalId,
      platform: 'threads',
      impressions: views,
      reach: views,
      likes,
      comments: replies,
      shares: reposts,
      saves: 0,
      clicks: 0,
      engagementRate: views > 0 ? ((likes + replies + reposts) / views) * 100 : 0,
      collectedAt: new Date(),
    }
  },

  async refreshToken(tokens: OAuthTokens): Promise<OAuthTokens> {
    const res = await fetch(
      `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${tokens.accessToken}`
    )
    const data = await res.json()
    if (!res.ok) throw new Error(`Threads token refresh failed: ${data.error?.message ?? JSON.stringify(data)}`)

    return {
      accessToken: data.access_token as string,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 5184000) * 1000),
    }
  },
}
