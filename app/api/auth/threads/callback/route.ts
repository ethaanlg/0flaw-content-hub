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

  const storedState = req.cookies.get('oauth_state_threads')?.value
  if (!storedState || storedState !== state) {
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
    process.env.THREADS_CALLBACK_URL ??
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/threads/callback`

  // Exchange code for short-lived token
  const tokenRes = await fetch('https://graph.threads.net/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      grant_type: 'authorization_code',
      redirect_uri: callbackUrl,
      code,
    }),
  })

  if (!tokenRes.ok) {
    console.error('Threads token exchange failed:', await tokenRes.text())
    return NextResponse.redirect(new URL('/connections?error=token_exchange', req.url))
  }

  const tokenData = await tokenRes.json()
  const shortToken: string = tokenData.access_token
  const shortUserId: string = String(tokenData.user_id)

  // Exchange for long-lived token (60 days)
  const longTokenRes = await fetch(
    `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${process.env.META_APP_SECRET}&access_token=${shortToken}`
  )

  const longTokenData = longTokenRes.ok ? await longTokenRes.json() : null
  const accessToken: string = longTokenData?.access_token ?? shortToken
  const expiresIn: number = longTokenData?.expires_in ?? 5183999

  // Fetch Threads user info
  const userRes = await fetch(
    `https://graph.threads.net/v1.0/${shortUserId}?fields=id,username,name&access_token=${accessToken}`
  )

  if (!userRes.ok) {
    console.error('Threads userinfo failed:', await userRes.text())
    return NextResponse.redirect(new URL('/connections?error=userinfo', req.url))
  }

  const profile = await userRes.json()
  const accountId: string = String(profile.id ?? shortUserId)
  const accountName: string = profile.username ?? profile.name ?? accountId

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  const { error: dbError } = await supabaseAdmin
    .from('platform_connections')
    .upsert(
      {
        user_id: user.id,
        platform: 'threads',
        account_id: accountId,
        account_name: accountName,
        access_token: accessToken,
        refresh_token: longTokenData?.access_token ?? null,
        expires_at: expiresAt,
        scopes: ['threads_basic', 'threads_content_publish', 'threads_manage_insights'],
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,platform,account_id' }
    )

  if (dbError) {
    console.error('Threads DB upsert error:', dbError)
    return NextResponse.redirect(new URL('/connections?error=db', req.url))
  }

  const redirectResponse = NextResponse.redirect(new URL('/connections?success=threads', req.url))
  redirectResponse.cookies.delete('oauth_state_threads')
  return redirectResponse
}
