// lib/platforms/types.ts

export type Platform = 'linkedin' | 'instagram' | 'x' | 'threads'

export interface OAuthTokens {
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
  scopes?: string[]
}

export interface PostContent {
  text: string
  mediaUrls?: string[]          // Supabase Storage public URLs
  carouselSlides?: string[]     // For LinkedIn PDF carousel (URLs to individual slide images)
  pdfUrl?: string               // Compiled PDF for LinkedIn document posts
  threadItems?: string[]        // For X threads: array of tweet texts
  contentType: 'text' | 'carousel' | 'image' | 'video' | 'thread'
}

export interface PublishResult {
  success: boolean
  externalId?: string           // Platform-specific post ID
  url?: string                  // Direct link to published post
  error?: string
}

export interface ScheduleResult {
  success: boolean
  scheduledId?: string
  error?: string
}

export interface PostAnalytics {
  postId: string                // Our internal post ID
  externalId: string            // Platform post ID
  platform: Platform
  impressions: number
  reach: number
  likes: number
  comments: number
  shares: number
  saves: number
  clicks: number
  videoViews?: number
  engagementRate: number        // (likes+comments+shares) / impressions * 100
  collectedAt: Date
}

export interface PlatformAdapter {
  platform: Platform
  publish(content: PostContent, tokens: OAuthTokens): Promise<PublishResult>
  getAnalytics(externalId: string, tokens: OAuthTokens): Promise<PostAnalytics>
  refreshToken(tokens: OAuthTokens): Promise<OAuthTokens>
}
