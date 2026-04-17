import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(new URL('/connections?error=oauth_denied', req.url))
  }

  const storedState = req.cookies.get('oauth_state_x')?.value
  const codeVerifier = req.cookies.get('oauth_pkce_x')?.value

  if (!storedState || storedState !== state || !codeVerifier) {
    return NextResponse.redirect(new URL('/connections?error=invalid_state', req.url))
  }

  const authResponse = new NextResponse()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (newCookies) =>
          newCookies.forEach(({ name, value, options }) =>
            authResponse.cookies.set(name, value, options)
          ),
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const callbackUrl =
    process.env.X_CALLBACK_URL ??
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/x/callback`

  // Basic auth for X OAuth 2.0 PKCE
  const credentials = Buffer.from(
    `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
  ).toString('base64')

  const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl,
      code_verifier: codeVerifier,
    }),
  })

  if (!tokenRes.ok) {
    console.error('X token exchange failed:', await tokenRes.text())
    return NextResponse.redirect(new URL('/connections?error=token_exchange', req.url))
  }

  const tokenData = await tokenRes.json()
  const accessToken: string = tokenData.access_token
  const refreshToken: string | null = tokenData.refresh_token ?? null
  const expiresIn: number = tokenData.expires_in ?? 7200

  // Fetch X user info
  const userRes = await fetch('https://api.twitter.com/2/users/me?user.fields=name,username', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!userRes.ok) {
    console.error('X userinfo failed:', await userRes.text())
    return NextResponse.redirect(new URL('/connections?error=userinfo', req.url))
  }

  const { data: xUser } = await userRes.json()
  const accountId: string = xUser.id
  const accountName: string = xUser.name ?? xUser.username ?? accountId

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  const { error: dbError } = await supabaseAdmin
    .from('platform_connections')
    .upsert(
      {
        user_id: user.id,
        platform: 'x',
        account_id: accountId,
        account_name: accountName,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        scopes: 'tweet.read tweet.write users.read offline.access',
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,platform,account_id' }
    )

  if (dbError) {
    console.error('X DB upsert error:', dbError)
    return NextResponse.redirect(new URL('/connections?error=db', req.url))
  }

  const redirectResponse = NextResponse.redirect(new URL('/connections?success=x', req.url))
  redirectResponse.cookies.delete('oauth_state_x')
  redirectResponse.cookies.delete('oauth_pkce_x')
  return redirectResponse
}
