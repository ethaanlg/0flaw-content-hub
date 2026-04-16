import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendConfirmationEmail } from '@/lib/brevo'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, firstName, company } = body as {
      email?: string
      firstName?: string
      company?: string
    }

    // Validate email format
    if (!email?.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }

    // Check if already confirmed and not unsubscribed
    const { data: existing } = await supabaseAdmin
      .from('newsletter_subscribers')
      .select('id, confirmed_at, unsubscribed_at')
      .eq('email', email)
      .single()

    if (existing?.confirmed_at && !existing?.unsubscribed_at) {
      return NextResponse.json({ message: 'Déjà inscrit' }, { status: 200 })
    }

    // Generate confirmation token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

    // Consent IP from header
    const consentIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

    // Upsert subscriber
    const { error: upsertError } = await supabaseAdmin
      .from('newsletter_subscribers')
      .upsert(
        {
          email,
          first_name: firstName ?? null,
          company: company ?? null,
          consent_given_at: new Date().toISOString(),
          consent_ip: consentIp,
          confirm_token: token,
          confirm_token_expires_at: expiresAt,
          unsubscribed_at: null,
        },
        { onConflict: 'email' }
      )

    if (upsertError) {
      console.error('[newsletter/subscribe] upsert error:', upsertError)
      return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
    }

    // Build confirmation URL and send email
    const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/newsletter/confirm?token=${token}`

    await sendConfirmationEmail({ email, firstName, confirmUrl })

    return NextResponse.json({ message: 'Email de confirmation envoyé' }, { status: 200 })
  } catch (err) {
    console.error('[newsletter/subscribe] unexpected error:', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
