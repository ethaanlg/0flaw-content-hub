import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import crypto from 'crypto'

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

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
  const codeVerifier = base64url(crypto.randomBytes(32))
  const codeChallenge = base64url(
    crypto.createHash('sha256').update(codeVerifier).digest()
  )

  const callbackUrl =
    process.env.X_CALLBACK_URL ??
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/x/callback`

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.X_CLIENT_ID!,
    redirect_uri: callbackUrl,
    scope: 'tweet.read tweet.write users.read offline.access',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  const redirectResponse = NextResponse.redirect(
    `https://twitter.com/i/oauth2/authorize?${params}`
  )
  response.cookies.getAll().forEach(({ name, value, ...opts }) =>
    redirectResponse.cookies.set(name, value, opts)
  )
  redirectResponse.cookies.set('oauth_state_x', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  redirectResponse.cookies.set('oauth_pkce_x', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  return redirectResponse
}
