import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { publishLinkedInPost } from '@/lib/linkedin'
import { publishInstagramCarousel } from '@/lib/instagram'
import { PublishBodySchema, parseBody } from '@/lib/zod-schemas'

export async function POST(req: NextRequest) {
  try {
    const parsed = parseBody(PublishBodySchema, await req.json())
    if (!parsed.success) return parsed.response

    const { postId } = parsed.data

    const { data: post, error } = await supabaseAdmin
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single()

    if (error || !post) return NextResponse.json({ error: 'Post introuvable' }, { status: 404 })
    if (post.status === 'published') return NextResponse.json({ error: 'Déjà publié' }, { status: 409 })

    const results: Record<string, string> = {}
    const errors: string[] = []

    if (post.platforms.includes('linkedin') && post.pdf_url) {
      try {
        const liPostId = await publishLinkedInPost(
          post.description || post.title,
          post.pdf_url,
          post.title
        )
        results.linkedin_post_id = liPostId
      } catch (e: unknown) {
        errors.push(`LinkedIn: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    if (post.platforms.includes('instagram') && post.slides_urls?.length) {
      try {
        const igPostId = await publishInstagramCarousel(
          post.description || post.title,
          post.slides_urls
        )
        results.instagram_post_id = igPostId
      } catch (e: unknown) {
        errors.push(`Instagram: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    const hasSuccess = Object.keys(results).length > 0
    const { error: updateError } = await supabaseAdmin.from('posts').update({
      ...results,
      status: hasSuccess ? 'published' : 'failed',
      published_at: hasSuccess ? new Date().toISOString() : null
    }).eq('id', postId)

    if (updateError) {
      console.error('[/api/publish] Failed to update post status:', updateError.message)
      return NextResponse.json({ error: 'Publication réussie mais mise à jour du statut échouée' }, { status: 500 })
    }

    return NextResponse.json({ success: hasSuccess, results, errors })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
