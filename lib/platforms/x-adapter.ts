import { TwitterApi } from 'twitter-api-v2'
import type { PlatformAdapter, PostContent, OAuthTokens, PublishResult, PostAnalytics } from './types'

export const xAdapter: PlatformAdapter = {
  platform: 'x',

  async publish(content: PostContent, tokens: OAuthTokens): Promise<PublishResult> {
    try {
      const client = new TwitterApi(tokens.accessToken)

      if (content.contentType === 'thread' && (content.threadItems?.length ?? 0) > 1) {
        const items = content.threadItems!
        let firstId: string | undefined
        let previousId: string | undefined

        for (const text of items) {
          const params: Parameters<typeof client.v2.tweet>[0] = { text: text.slice(0, 280) }
          if (previousId) {
            params.reply = { in_reply_to_tweet_id: previousId }
          }
          const { data } = await client.v2.tweet(params)
          if (!firstId) firstId = data.id
          previousId = data.id
        }

        if (!firstId) throw new Error('Thread published but first tweet ID was not captured')
        return { success: true, externalId: firstId }
      } else {
        const { data } = await client.v2.tweet({ text: content.text.slice(0, 280) })
        return { success: true, externalId: data.id }
      }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },

  async getAnalytics(externalId: string, tokens: OAuthTokens): Promise<PostAnalytics> {
    const client = new TwitterApi(tokens.accessToken)
    const { data } = await client.v2.singleTweet(externalId, {
      'tweet.fields': ['public_metrics'],
    })

    const pub = data.public_metrics
    const impressions = pub?.impression_count ?? 0
    const likes = pub?.like_count ?? 0
    const comments = pub?.reply_count ?? 0
    const shares = pub?.retweet_count ?? 0
    const saves = pub?.bookmark_count ?? 0

    return {
      postId: externalId,
      externalId,
      platform: 'x',
      impressions,
      reach: impressions,
      likes,
      comments,
      shares,
      saves,
      clicks: 0,
      engagementRate: impressions > 0 ? ((likes + comments + shares) / impressions) * 100 : 0,
      collectedAt: new Date(),
    }
  },

  async refreshToken(tokens: OAuthTokens): Promise<OAuthTokens> {
    const clientId = process.env.X_CLIENT_ID!
    const clientSecret = process.env.X_CLIENT_SECRET!
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const res = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken ?? '',
        client_id: clientId,
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(`X token refresh failed: ${data.error_description ?? data.error}`)

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 7200) * 1000),
    }
  },
}
