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

  const storedState = req.cookies.get('oauth_state_linkedin')?.value
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(new URL('/connections?error=invalid_state', req.url))
  }

  // Get authenticated user
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
    process.env.LINKEDIN_CALLBACK_URL ??
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linkedin/callback`

  // Exchange code for token
  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
  })

  if (!tokenRes.ok) {
    console.error('LinkedIn token exchange failed:', await tokenRes.text())
    return NextResponse.redirect(new URL('/connections?error=token_exchange', req.url))
  }

  const tokenData = await tokenRes.json()
  const accessToken: string = tokenData.access_token
  const expiresIn: number = tokenData.expires_in ?? 5183999

  // Fetch LinkedIn user info
  const userRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!userRes.ok) {
    console.error('LinkedIn userinfo failed:', await userRes.text())
    return NextResponse.redirect(new URL('/connections?error=userinfo', req.url))
  }

  const profile = await userRes.json()
  const accountId: string = profile.sub
  const accountName: string = profile.name ?? profile.email ?? accountId

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  // Upsert into platform_connections
  const { error: dbError } = await supabaseAdmin
    .from('platform_connections')
    .upsert(
      {
        user_id: user.id,
        platform: 'linkedin',
        account_id: accountId,
        account_name: accountName,
        access_token: accessToken,
        refresh_token: tokenData.refresh_token ?? null,
        expires_at: expiresAt,
        scopes: ['openid', 'profile', 'email', 'w_member_social'],
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,platform,account_id' }
    )

  if (dbError) {
    console.error('LinkedIn DB upsert error:', dbError)
    return NextResponse.redirect(new URL('/connections?error=db', req.url))
  }

  const redirectResponse = NextResponse.redirect(new URL('/connections?success=linkedin', req.url))
  redirectResponse.cookies.delete('oauth_state_linkedin')
  return redirectResponse
}
