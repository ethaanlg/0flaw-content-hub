import { z } from 'zod'
import { NextResponse } from 'next/server'

export const GenerateBodySchema = z.object({
  topic: z.string().min(3, 'Sujet trop court (min 3 caractères)').max(200),
  title: z.string().max(200).optional(),
  content_type: z.enum(['carousel', 'text']).optional().default('carousel'),
})

export const PublishBodySchema = z.object({
  postId: z.string().uuid('postId doit être un UUID valide'),
})

export const SlidesBodySchema = z.object({
  slides: z.array(z.unknown()).min(1, 'Au moins un slide requis'),
})

export const PostsUpdateBodySchema = z.object({
  id: z.string().uuid('id doit être un UUID valide'),
  status: z.enum(['draft', 'scheduled', 'published', 'failed']).optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
})

export const StatsBodySchema = z.object({
  postId: z.string().uuid('postId doit être un UUID valide'),
})

export const GenerateTextPostSchema = z.object({
  topic: z.string().min(3, 'Sujet trop court (min 3 caractères)').max(200),
  title: z.string().max(200).optional(),
  content_type: z.literal('text'),
})

export const TopicCreateSchema = z.object({
  title: z.string().min(2, 'Titre trop court').max(100),
  description: z.string().max(300).optional(),
  category: z.string().max(50).default('custom'),
})

export function parseBody<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data)
  if (!result.success) {
    const firstError = result.error.issues[0]?.message || 'Validation échouée'
    return {
      success: false,
      response: NextResponse.json(
        { error: firstError },
        { status: 400 }
      ),
    }
  }
  return { success: true, data: result.data }
}
