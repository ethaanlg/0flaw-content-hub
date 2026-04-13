// app/api/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const redirectTo = searchParams.get('redirectTo') ?? '/dashboard'

  // Valider que redirectTo est un chemin relatif interne
  const safeRedirectTo = redirectTo.startsWith('/') ? redirectTo : '/dashboard'

  // Créer la response d'abord — les cookies de session doivent être écrits sur la response
  const response = NextResponse.redirect(new URL(safeRedirectTo, req.url))

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (newCookies) =>
            newCookies.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            ),
        },
      }
    )
    await supabase.auth.exchangeCodeForSession(code)
  }

  return response
}
