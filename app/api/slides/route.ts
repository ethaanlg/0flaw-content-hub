import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import React from 'react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { renderToBuffer } from '@react-pdf/renderer'
import { CarouselDocument } from '@/lib/pdf-render'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { SlidesBodySchema, parseBody } from '@/lib/zod-schemas'
import type { Slide } from '@/lib/slides-gen'

export async function POST(req: NextRequest) {
  // Auth guard — protège le storage Supabase contre les abus
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  try {
    const parsed = parseBody(SlidesBodySchema, await req.json())
    if (!parsed.success) return parsed.response

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slides = parsed.data.slides as any as Slide[]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(CarouselDocument, { slides }) as any
    const buffer = await renderToBuffer(element)

    const fileName = `${user.id}/${Date.now()}-carousel.pdf`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('carousels')
      .upload(fileName, buffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('carousels')
      .getPublicUrl(fileName)

    return NextResponse.json({ pdfUrl: publicUrl })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
