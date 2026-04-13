import { createClient } from '@supabase/supabase-js'

// Admin client — server-side only (API routes, Server Components)
// Bypasses RLS — utiliser uniquement dans les cron jobs et routes admin.
// JAMAIS importer dans les client components ou routes accessibles publiquement.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
