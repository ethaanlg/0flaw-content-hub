// Meta Graph API helpers (Instagram Business)

import { withRetry } from './retry'

const META_BASE = 'https://graph.facebook.com/v19.0'
const IG_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID
const TOKEN = process.env.META_ACCESS_TOKEN

// Publier un carrousel Instagram (tableau d'URLs d'images PNG)
export async function publishInstagramCarousel(
  caption: string,
  imageUrls: string[]
): Promise<string> {
  return withRetry(async () => {
    // Étape 1 : créer un container pour chaque image
    const childIds: string[] = []
    for (const imageUrl of imageUrls) {
      const res = await fetch(
        `${META_BASE}/${IG_ID}/media?image_url=${encodeURIComponent(imageUrl)}&is_carousel_item=true&access_token=${TOKEN}`,
        { method: 'POST' }
      )
      const data = await res.json()
      if (!data.id) throw new Error(`Erreur création slide: ${JSON.stringify(data)}`)
      childIds.push(data.id)
    }

    // Étape 2 : créer le container carrousel
    const carouselRes = await fetch(`${META_BASE}/${IG_ID}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'CAROUSEL',
        children: childIds,
        caption,
        access_token: TOKEN
      })
    })
    const carouselData = await carouselRes.json()
    if (!carouselData.id) throw new Error(`Erreur container carrousel: ${JSON.stringify(carouselData)}`)

    // Étape 3 : publier
    const publishRes = await fetch(`${META_BASE}/${IG_ID}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: carouselData.id,
        access_token: TOKEN
      })
    })
    const publishData = await publishRes.json()
    return publishData.id
  }, { maxAttempts: 3, baseDelayMs: 1000, label: 'publishInstagramCarousel' })
}

// Récupérer les stats d'un post Instagram
export async function getInstagramPostStats(mediaId: string) {
  return withRetry(async () => {
    const fields = 'impressions,reach,likes_count,comments_count,shares,saved,total_interactions'
    const res = await fetch(
      `${META_BASE}/${mediaId}/insights?metric=${fields}&access_token=${TOKEN}`
    )
    const data = await res.json()
    const metrics: Record<string, number> = {}
    for (const item of data.data || []) {
      metrics[item.name] = item.values?.[0]?.value || 0
    }
    const impressions = metrics.impressions || 0
    const interactions = metrics.total_interactions || 0
    return {
      impressions,
      reach: metrics.reach || 0,
      likes: metrics.likes_count || 0,
      comments: metrics.comments_count || 0,
      shares: metrics.shares || 0,
      saves: metrics.saved || 0,
      clicks: 0,
      engagement_rate: impressions ? parseFloat(((interactions / impressions) * 100).toFixed(2)) : 0
    }
  }, { maxAttempts: 3, baseDelayMs: 500, label: 'getInstagramPostStats' })
}
