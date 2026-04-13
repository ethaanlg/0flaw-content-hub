import { createClient } from '@supabase/supabase-js'

// Public client — safe to import in client components
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type { Post, PostStats, Settings } from './types'
