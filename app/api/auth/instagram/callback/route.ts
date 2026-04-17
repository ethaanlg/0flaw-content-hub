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

  const storedState = req.cookies.get('oauth_state_instagram')?.value
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
    process.env.INSTAGRAM_CALLBACK_URL ??
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`

  // Exchange code for short-lived token
  const tokenRes = await fetch('https://graph.facebook.com/v21.0/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      redirect_uri: callbackUrl,
      code,
    }),
  })

  if (!tokenRes.ok) {
    console.error('Instagram token exchange failed:', await tokenRes.text())
    return NextResponse.redirect(new URL('/connections?error=token_exchange', req.url))
  }

  const tokenData = await tokenRes.json()
  const shortToken: string = tokenData.access_token

  // Exchange for long-lived token (60 days)
  const longTokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${shortToken}`
  )

  const longTokenData = longTokenRes.ok ? await longTokenRes.json() : null
  const accessToken: string = longTokenData?.access_token ?? shortToken
  const expiresIn: number = longTokenData?.expires_in ?? 5183999

  // Get Facebook user ID, then find the linked Instagram Business account
  const meRes = await fetch(
    `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${accessToken}`
  )

  if (!meRes.ok) {
    console.error('Instagram me failed:', await meRes.text())
    return NextResponse.redirect(new URL('/connections?error=userinfo', req.url))
  }

  const me = await meRes.json()

  // Try to get Instagram account linked to this FB user
  const igRes = await fetch(
    `https://graph.facebook.com/v21.0/${me.id}/accounts?fields=instagram_business_account{id,name,username}&access_token=${accessToken}`
  )

  let accountId: string = me.id
  let accountName: string = me.name ?? accountId

  if (igRes.ok) {
    const igData = await igRes.json()
    const page = igData.data?.[0]
    if (page?.instagram_business_account) {
      accountId = page.instagram_business_account.id
      accountName =
        page.instagram_business_account.username ??
        page.instagram_business_account.name ??
        accountName
    }
  }

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  const { error: dbError } = await supabaseAdmin
    .from('platform_connections')
    .upsert(
      {
        user_id: user.id,
        platform: 'instagram',
        account_id: accountId,
        account_name: accountName,
        access_token: accessToken,
        refresh_token: null,
        expires_at: expiresAt,
        scopes:
          'instagram_basic,instagram_content_publish,instagram_manage_insights,pages_show_list',
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,platform,account_id' }
    )

  if (dbError) {
    console.error('Instagram DB upsert error:', dbError)
    return NextResponse.redirect(new URL('/connections?error=db', req.url))
  }

  const redirectResponse = NextResponse.redirect(
    new URL('/connections?success=instagram', req.url)
  )
  redirectResponse.cookies.delete('oauth_state_instagram')
  return redirectResponse
}
