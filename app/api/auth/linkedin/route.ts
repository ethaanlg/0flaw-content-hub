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
    process.env.LINKEDIN_CALLBACK_URL ??
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linkedin/callback`

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: callbackUrl,
    state,
    scope: 'openid profile email w_member_social',
  })

  const redirectResponse = NextResponse.redirect(
    `https://www.linkedin.com/oauth/v2/authorization?${params}`
  )
  // Copy cookies from the supabase client response
  response.cookies.getAll().forEach(({ name, value, ...opts }) =>
    redirectResponse.cookies.set(name, value, opts)
  )
  redirectResponse.cookies.set('oauth_state_linkedin', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  return redirectResponse
}
