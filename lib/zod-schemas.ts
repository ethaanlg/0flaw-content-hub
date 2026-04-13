import { z } from 'zod'
import { NextResponse } from 'next/server'

export const GenerateBodySchema = z.object({
  topic: z.string().min(3, 'Sujet trop court (min 3 caractères)').max(200),
  title: z.string().max(200).optional(),
})

export const PublishBodySchema = z.object({
  postId: z.string().uuid('postId doit être un UUID valide'),
})

export const SlidesBodySchema = z.object({
  slides: z.array(z.any()).min(1, 'Au moins un slide requis'),
})

export const PostsUpdateBodySchema = z.object({
  id: z.string().uuid('id doit être un UUID valide'),
  status: z.enum(['draft', 'scheduled', 'published', 'failed']).optional(),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
})

export const StatsBodySchema = z.object({
  postId: z.string().uuid('postId doit être un UUID valide'),
})

export function parseBody<T>(
  schema: z.ZodSchema<T>,
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
