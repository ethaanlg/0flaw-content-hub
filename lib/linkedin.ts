// LinkedIn API v2 helpers

import { withRetry } from './retry'

const LI_BASE = 'https://api.linkedin.com/v2'
const ORG_ID = process.env.LINKEDIN_ORGANIZATION_ID
const TOKEN = process.env.LINKEDIN_ACCESS_TOKEN

function headers() {
  return {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'X-Restli-Protocol-Version': '2.0.0',
  }
}

// Publier un post texte + document PDF (carrousel)
export async function publishLinkedInPost(
  text: string,
  pdfUrl: string,
  pdfTitle: string
): Promise<string> {
  return withRetry(async () => {
    // Étape 1 : initialiser l'upload du document
    const initRes = await fetch(`${LI_BASE}/assets?action=registerUpload`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-document'],
          owner: `urn:li:organization:${ORG_ID}`,
          serviceRelationships: [{
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent'
          }]
        }
      })
    })
    const initData = await initRes.json()
    if (!initRes.ok) {
      throw new Error(`LinkedIn registerUpload ${initRes.status}: ${JSON.stringify(initData)}`)
    }
    const uploadUrl = initData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl
    const asset = initData.value.asset

    // Étape 2 : uploader le PDF
    const pdfBuffer = await fetch(pdfUrl).then(r => r.arrayBuffer())
    await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: pdfBuffer
    })

    // Étape 3 : créer le post
    const postRes = await fetch(`${LI_BASE}/ugcPosts`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        author: `urn:li:organization:${ORG_ID}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text },
            shareMediaCategory: 'DOCUMENT',
            media: [{
              status: 'READY',
              description: { text: pdfTitle },
              media: asset,
              title: { text: pdfTitle }
            }]
          }
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
      })
    })

    const postData = await postRes.json()
    if (!postRes.ok) {
      throw new Error(`LinkedIn ugcPosts ${postRes.status}: ${JSON.stringify(postData)}`)
    }
    return postData.id
  }, { maxAttempts: 3, baseDelayMs: 1000, label: 'publishLinkedInPost' })
}

// Récupérer les stats d'un post LinkedIn
export async function getLinkedInPostStats(postId: string) {
  return withRetry(async () => {
    // Encoder l'URN pour l'URL
    const encodedId = encodeURIComponent(postId)
    const res = await fetch(
      `${LI_BASE}/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${ORG_ID}&ugcPosts=List(${encodedId})`,
      { headers: headers() }
    )
    const data = await res.json()
    const stats = data.elements?.[0]?.totalShareStatistics || {}
    return {
      impressions: stats.impressionCount || 0,
      reach: stats.uniqueImpressionsCount || 0,
      likes: stats.likeCount || 0,
      comments: stats.commentCount || 0,
      shares: stats.shareCount || 0,
      clicks: stats.clickCount || 0,
      engagement_rate: stats.impressionCount
        ? parseFloat((((stats.likeCount + stats.commentCount + stats.shareCount) / stats.impressionCount) * 100).toFixed(2))
        : 0
    }
  }, { maxAttempts: 3, baseDelayMs: 500, label: 'getLinkedInPostStats' })
}
