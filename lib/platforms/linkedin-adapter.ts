import type { PlatformAdapter, PostContent, OAuthTokens, PublishResult, PostAnalytics } from './types'

export const linkedinAdapter: PlatformAdapter = {
  platform: 'linkedin',

  async publish(content: PostContent, tokens: OAuthTokens): Promise<PublishResult> {
    try {
      const { publishLinkedInPost } = await import('../linkedin')

      // publishLinkedInPost expects: (text: string, pdfUrl: string, pdfTitle: string, token?: string)
      // We support PDF-based posts; text content goes in the commentary
      if (!content.pdfUrl) {
        throw new Error('LinkedIn adapter currently requires a pdfUrl for content')
      }

      const pdfTitle = content.text.slice(0, 60).replace(/\n[\s\S]*/g, '').trim() || 'Carrousel 0Flaw'
      const postId = await publishLinkedInPost(
        content.text,
        content.pdfUrl,
        pdfTitle,
        tokens.accessToken
      )

      return { success: true, externalId: postId }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },

  async getAnalytics(externalId: string, tokens: OAuthTokens): Promise<PostAnalytics> {
    try {
      const { getLinkedInPostStats } = await import('../linkedin')
      const stats = await getLinkedInPostStats(externalId, tokens.accessToken)

      return {
        postId: externalId,
        externalId,
        platform: 'linkedin',
        impressions: stats.impressions ?? 0,
        reach: stats.reach ?? 0,
        likes: stats.likes ?? 0,
        comments: stats.comments ?? 0,
        shares: stats.shares ?? 0,
        saves: 0,
        clicks: stats.clicks ?? 0,
        engagementRate: stats.engagement_rate ?? 0,
        collectedAt: new Date(),
      }
    } catch (e) {
      throw e
    }
  },

  async refreshToken(tokens: OAuthTokens): Promise<OAuthTokens> {
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken ?? '',
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`LinkedIn token refresh failed: ${data.error_description}`)
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    }
  },
}
