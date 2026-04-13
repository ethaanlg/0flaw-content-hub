import { createClient } from '@supabase/supabase-js'

// Admin client — server-side only (API routes, Server Components)
// Never import this in client components ('use client')
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
