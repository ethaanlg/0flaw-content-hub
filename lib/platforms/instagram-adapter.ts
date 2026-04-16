import type { PlatformAdapter, PostContent, OAuthTokens, PublishResult, PostAnalytics } from './types'

export const instagramAdapter: PlatformAdapter = {
  platform: 'instagram',

  async publish(content: PostContent, tokens: OAuthTokens): Promise<PublishResult> {
    try {
      const prevToken = process.env.META_ACCESS_TOKEN
      process.env.META_ACCESS_TOKEN = tokens.accessToken

      const { publishInstagramCarousel } = await import('../instagram')
      const postId = await publishInstagramCarousel(
        content.text,
        content.mediaUrls ?? []
      )

      process.env.META_ACCESS_TOKEN = prevToken
      return { success: true, externalId: postId }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },

  async getAnalytics(externalId: string, tokens: OAuthTokens): Promise<PostAnalytics> {
    const prevToken = process.env.META_ACCESS_TOKEN
    process.env.META_ACCESS_TOKEN = tokens.accessToken

    const { getInstagramPostStats } = await import('../instagram')
    const stats = await getInstagramPostStats(externalId)

    process.env.META_ACCESS_TOKEN = prevToken

    const impressions = stats?.impressions ?? 0
    const likes = stats?.likes ?? 0
    const comments = stats?.comments ?? 0
    const shares = stats?.shares ?? 0
    const saves = stats?.saves ?? 0
    const engagementRate = stats?.engagement_rate ?? 0

    return {
      postId: externalId,
      externalId,
      platform: 'instagram',
      impressions,
      reach: stats?.reach ?? 0,
      likes,
      comments,
      shares,
      saves,
      clicks: stats?.clicks ?? 0,
      engagementRate,
      collectedAt: new Date(),
    }
  },

  async refreshToken(tokens: OAuthTokens): Promise<OAuthTokens> {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${tokens.accessToken}`
    )
    const data = await res.json()
    if (!res.ok) throw new Error(`Meta token refresh failed: ${data.error?.message}`)
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 5184000) * 1000),
    }
  },
}
