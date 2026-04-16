import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createBrevoContact } from '@/lib/brevo'

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(`${appUrl}/?nl=invalid`)
  }

  // Look up subscriber by token
  const { data: subscriber, error } = await supabaseAdmin
    .from('newsletter_subscribers')
    .select('id, email, first_name, company, confirm_token_expires_at')
    .eq('confirm_token', token)
    .single()

  if (error || !subscriber) {
    return NextResponse.redirect(`${appUrl}/?nl=invalid`)
  }

  // Check token expiry
  const expiresAt = new Date(subscriber.confirm_token_expires_at as string)
  if (expiresAt < new Date()) {
    return NextResponse.redirect(`${appUrl}/?nl=expired`)
  }

  // Add contact to Brevo (best-effort — do not block confirmation on failure)
  let brevoContactId: number | null = null
  try {
    const brevoResult = await createBrevoContact({
      email: subscriber.email as string,
      firstName: subscriber.first_name as string | undefined,
      company: subscriber.company as string | undefined,
      listId: Number(process.env.BREVO_LIST_ID ?? '1'),
    })
    brevoContactId = brevoResult.id
  } catch (brevoErr) {
    console.error('[newsletter/confirm] Brevo createContact error (non-fatal):', brevoErr)
  }

  // Confirm subscriber
  const { error: updateError } = await supabaseAdmin
    .from('newsletter_subscribers')
    .update({
      confirmed_at: new Date().toISOString(),
      confirm_token: null,
      confirm_token_expires_at: null,
      ...(brevoContactId != null ? { brevo_contact_id: brevoContactId } : {}),
    })
    .eq('id', subscriber.id)

  if (updateError) {
    console.error('[newsletter/confirm] update error:', updateError)
  }

  return NextResponse.redirect(`${appUrl}/?nl=confirmed`)
}
