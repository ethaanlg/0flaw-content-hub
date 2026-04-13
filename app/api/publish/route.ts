import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { publishLinkedInPost } from '@/lib/linkedin'
import { publishInstagramCarousel } from '@/lib/instagram'

export async function POST(req: NextRequest) {
  try {
    const { postId } = await req.json()
    if (!postId) return NextResponse.json({ error: 'postId requis' }, { status: 400 })

    // Récupérer le post
    const { data: post, error } = await supabaseAdmin
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single()

    if (error || !post) return NextResponse.json({ error: 'Post introuvable' }, { status: 404 })
    if (post.status === 'published') return NextResponse.json({ error: 'Déjà publié' }, { status: 409 })

    const results: Record<string, string> = {}
    const errors: string[] = []

    // Publier sur LinkedIn
    if (post.platforms.includes('linkedin') && post.pdf_url) {
      try {
        const liPostId = await publishLinkedInPost(
          post.description || post.title,
          post.pdf_url,
          post.title
        )
        results.linkedin_post_id = liPostId
      } catch (e: any) {
        errors.push(`LinkedIn: ${e.message}`)
      }
    }

    // Publier sur Instagram
    if (post.platforms.includes('instagram') && post.slides_urls?.length) {
      try {
        const igPostId = await publishInstagramCarousel(
          post.description || post.title,
          post.slides_urls
        )
        results.instagram_post_id = igPostId
      } catch (e: any) {
        errors.push(`Instagram: ${e.message}`)
      }
    }

    // Mettre à jour le statut en base
    const hasSuccess = Object.keys(results).length > 0
    await supabaseAdmin.from('posts').update({
      ...results,
      status: hasSuccess ? 'published' : 'failed',
      published_at: hasSuccess ? new Date().toISOString() : null
    }).eq('id', postId)

    return NextResponse.json({ success: hasSuccess, results, errors })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
