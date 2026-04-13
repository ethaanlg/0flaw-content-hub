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
  content_type: ContentType
  linkedin_text: string | null
  instagram_text: string | null
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

export type ContentType = 'carousel' | 'text'

export type CuratedTopic = {
  id: string             // stable slug, e.g. "phishing-pme"
  title: string
  description: string
  category: 'menaces' | 'conformite' | 'sensibilisation'
}

export type UserTopic = {
  id: string             // UUID from Supabase
  title: string
  description: string | null
  category: string
  created_at: string
}

export type TextPost = {
  linkedin: string
  instagram: string
}
