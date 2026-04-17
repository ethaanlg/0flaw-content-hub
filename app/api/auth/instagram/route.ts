import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import crypto from 'crypto'

export async function GET(req: NextRequest) {
  const response = new NextResponse()

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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const state = crypto.randomBytes(16).toString('hex')
  const callbackUrl =
    process.env.INSTAGRAM_CALLBACK_URL ??
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: callbackUrl,
    scope: 'instagram_basic,instagram_content_publish,instagram_manage_insights,pages_show_list',
    response_type: 'code',
    state,
  })

  const redirectResponse = NextResponse.redirect(
    `https://www.facebook.com/v21.0/dialog/oauth?${params}`
  )
  response.cookies.getAll().forEach(({ name, value, ...opts }) =>
    redirectResponse.cookies.set(name, value, opts)
  )
  redirectResponse.cookies.set('oauth_state_instagram', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  return redirectResponse
}
