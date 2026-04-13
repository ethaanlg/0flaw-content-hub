export type Post = {
  id: string
  title: string
  topic: string | null
  description: string | null
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  platforms: string[]
  scheduled_at: string | null
  published_at: string | null
  linkedin_post_id: string | null
  instagram_post_id: string | null
  pdf_url: string | null
  slides_urls: string[] | null
  created_at: string
  updated_at: string
}

export type PostStats = {
  id: string
  post_id: string
  platform: 'linkedin' | 'instagram'
  collected_at: string
  impressions: number
  reach: number
  likes: number
  comments: number
  shares: number
  saves: number
  clicks: number
  engagement_rate: number
}

export type Settings = {
  weekGoal: number
  optimalDays: number[]
  optimalHour: number
  defaultPlatforms: string[]
  aiModel: string
  linkedinConnected: boolean
  instagramConnected: boolean
}
