import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'
import type { Slide, SlideTag } from './slides-gen'

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  bg:     '#0f1225',
  bg2:    '#1a1f36',
  bg3:    '#222840',
  accent: '#4f6fff',
  red:    '#ff4f6f',
  green:  '#3dffa0',
  white:  '#ffffff',
  muted:  '#6b7599',
  bullet: '#a0b0ff',
}

function resolveTagColor(color?: SlideTag['color']): string {
  if (color === 'red')   return C.red
  if (color === 'green') return C.green
  if (color === 'white') return C.white
  return C.accent
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    width: 540, height: 675,
    backgroundColor: C.bg,
    padding: 0,
    fontFamily: 'Helvetica',
    position: 'relative',
  },

  // Decorations
  topBar:            { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: C.accent },
  topBarRed:         { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: C.red },
  topBarGreen:       { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: C.green },
  cornerAccent:      { position: 'absolute', top: 0, right: 0, width: 80, height: 80, backgroundColor: C.accent, opacity: 0.06 },
  cornerBottomLeft:  { position: 'absolute', bottom: 0, left: 0, width: 60, height: 60, backgroundColor: C.green, opacity: 0.05 },

  // Tag
  tag: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 16,
  },
  tagText: {
    fontSize: 10, fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5,
  },
  tagIcon: {
    fontSize: 10, fontFamily: 'Helvetica-Bold',
    marginRight: 5, letterSpacing: 0,
  },

  // Slide number
  slideNum: {
    fontSize: 10, fontFamily: 'Helvetica-Bold',
    color: C.accent, letterSpacing: 2,
    marginBottom: 12,
  },

  // Headlines
  headline: {
    fontFamily: 'Helvetica-Bold', fontSize: 26,
    color: C.white, lineHeight: 1.35,
    letterSpacing: -0.3, marginBottom: 24,
  },
  headlineLg: {
    fontFamily: 'Helvetica-Bold', fontSize: 30,
    color: C.white, lineHeight: 1.3,
    letterSpacing: -0.5, marginBottom: 24,
    textAlign: 'center',
  },

  // Body / muted text
  body: {
    fontSize: 13, color: C.muted,
    lineHeight: 1.55, marginTop: 4,
  },

  // Bullets
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  bulletArrow: { fontSize: 13, color: C.accent, marginRight: 10, marginTop: 1, fontFamily: 'Helvetica-Bold' },
  bulletText: { fontSize: 14, color: C.bullet, lineHeight: 1.5, flex: 1 },

  // Stat
  statNumber: {
    fontFamily: 'Helvetica-Bold', fontSize: 72,
    color: C.accent, letterSpacing: -2,
    lineHeight: 1, marginBottom: 12,
  },
  statLabel: {
    fontSize: 10, fontFamily: 'Helvetica-Bold',
    color: C.muted, letterSpacing: 1.5,
    marginBottom: 20,
  },

  // Steps (system slide)
  stepRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 14, backgroundColor: C.bg2,
    borderRadius: 6, padding: 10,
  },
  stepNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  stepNumText: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.white },
  stepContent: { flex: 1 },
  stepText: { fontSize: 13, color: C.white, fontFamily: 'Helvetica-Bold', lineHeight: 1.3 },
  stepTiming: { fontSize: 11, color: C.muted, marginTop: 2 },

  // Quote (proof slide)
  quoteMark: { fontSize: 40, color: C.accent, fontFamily: 'Helvetica-Bold', lineHeight: 1, marginBottom: -4 },
  quoteText: { fontSize: 14, color: C.white, lineHeight: 1.55, fontFamily: 'Helvetica', marginBottom: 12 },
  quoteSource: { fontSize: 10, color: C.muted, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },

  // CTA
  ctaBox: {
    backgroundColor: C.bg2, borderRadius: 8,
    padding: 20, marginTop: 16, marginBottom: 16,
    borderWidth: 1, borderColor: C.bg3,
  },
  ctaOffer: { fontSize: 14, color: C.muted, lineHeight: 1.55 },
  ctaButton: {
    backgroundColor: C.accent, borderRadius: 6,
    paddingHorizontal: 20, paddingVertical: 10,
    alignSelf: 'center', marginTop: 16,
  },
  ctaButtonText: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.white, letterSpacing: 1 },
  ctaCredibility: { fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 12 },

  // Footer / brand
  footer: {
    position: 'absolute', bottom: 24, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center',
  },
  footerText: { fontSize: 10, color: C.muted, letterSpacing: 1.5, fontFamily: 'Helvetica-Bold' },
  footerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent, marginHorizontal: 8, marginTop: 3 },

  // Inner wrapper
  inner: { flex: 1, padding: 48, paddingTop: 52 },
  innerCenter: { flex: 1, padding: 48, alignItems: 'center', justifyContent: 'center' },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Render headline splitting accentPhrase into a differently-colored span */
function HeadlineAccent({
  text, accent, baseColor, accentColor, style,
}: {
  text: string; accent: string; baseColor: string; accentColor: string; style: Style
}) {
  if (!accent || !text.includes(accent)) {
    return <Text style={[style, { color: baseColor }]}>{text}</Text>
  }
  const idx = text.indexOf(accent)
  const before = text.slice(0, idx)
  const after  = text.slice(idx + accent.length)
  return (
    <Text style={[style, { color: baseColor }]}>
      {before}
      <Text style={{ color: accentColor }}>{accent}</Text>
      {after}
    </Text>
  )
}

function Tag({ tag }: { tag: SlideTag }) {
  const color = resolveTagColor(tag.color)
  return (
    <View style={S.tag}>
      {tag.icon ? <Text style={[S.tagIcon, { color }]}>{tag.icon}</Text> : null}
      <Text style={[S.tagText, { color }]}>{tag.label}</Text>
    </View>
  )
}

function TopBar({ color }: { color?: SlideTag['color'] }) {
  if (color === 'red')   return <View style={S.topBarRed} />
  if (color === 'green') return <View style={S.topBarGreen} />
  return <View style={S.topBar} />
}

function SlideNum({ idx, total }: { idx: number; total: number }) {
  return (
    <Text style={S.slideNum}>
      {String(idx).padStart(2, '0')} / {String(total).padStart(2, '0')}
    </Text>
  )
}

// ─── Slide Renderers ──────────────────────────────────────────────────────────

function CoverSlide({ slide, idx, total }: { slide: Extract<Slide, { type: 'cover' }>; idx: number; total: number }) {
  return (
    <Page size={[540, 675]} style={S.page}>
      <View style={S.topBar} />
      <View style={S.cornerAccent} />
      <View style={S.cornerBottomLeft} />
      <View style={S.inner}>
        <SlideNum idx={idx} total={total} />
        <Tag tag={slide.tag} />
        <HeadlineAccent
          text={slide.headline}
          accent={slide.accentPhrase}
          baseColor={C.white}
          accentColor={C.accent}
          style={S.headline}
        />
        <Text style={S.body}>{slide.body}</Text>
      </View>
      <View style={S.footer}>
        <View style={S.footerDot} />
        <Text style={S.footerText}>0FLAW</Text>
        <View style={S.footerDot} />
      </View>
    </Page>
  )
}

function ProblemSlide({ slide, idx, total }: { slide: Extract<Slide, { type: 'problem' }>; idx: number; total: number }) {
  return (
    <Page size={[540, 675]} style={S.page}>
      <TopBar color={slide.tag.color} />
      <View style={S.cornerAccent} />
      <View style={S.inner}>
        <SlideNum idx={idx} total={total} />
        <Tag tag={slide.tag} />
        <HeadlineAccent
          text={slide.headline}
          accent={slide.accentPhrase}
          baseColor={C.white}
          accentColor={C.red}
          style={S.headline}
        />
        {slide.bullets.map((b, i) => (
          <View key={i} style={S.bulletRow}>
            <Text style={S.bulletArrow}>›</Text>
            <Text style={S.bulletText}>{b}</Text>
          </View>
        ))}
      </View>
    </Page>
  )
}

function StatSlide({ slide, idx, total }: { slide: Extract<Slide, { type: 'stat' }>; idx: number; total: number }) {
  const accentColor = slide.tag.color === 'red' ? C.red : C.accent
  return (
    <Page size={[540, 675]} style={S.page}>
      <TopBar color={slide.tag.color} />
      <View style={S.cornerAccent} />
      <View style={S.inner}>
        <SlideNum idx={idx} total={total} />
        <Tag tag={slide.tag} />
        <Text style={[S.statNumber, { color: accentColor }]}>{slide.stat}</Text>
        <Text style={S.statLabel}>{slide.statLabel}</Text>
        <Text style={S.body}>{slide.body}</Text>
      </View>
    </Page>
  )
}

function InsightSlide({ slide, idx, total }: { slide: Extract<Slide, { type: 'insight' }>; idx: number; total: number }) {
  return (
    <Page size={[540, 675]} style={S.page}>
      <TopBar color={slide.tag.color} />
      <View style={S.cornerAccent} />
      <View style={S.inner}>
        <SlideNum idx={idx} total={total} />
        <Tag tag={slide.tag} />
        {slide.icon ? <Text style={{ fontSize: 36, marginBottom: 16 }}>{slide.icon}</Text> : null}
        <HeadlineAccent
          text={slide.headline}
          accent={slide.accentPhrase}
          baseColor={C.white}
          accentColor={C.accent}
          style={S.headline}
        />
        <Text style={S.body}>{slide.body}</Text>
      </View>
    </Page>
  )
}

function SystemSlide({ slide, idx, total }: { slide: Extract<Slide, { type: 'system' }>; idx: number; total: number }) {
  return (
    <Page size={[540, 675]} style={S.page}>
      <TopBar color={slide.tag.color} />
      <View style={S.cornerAccent} />
      <View style={S.inner}>
        <SlideNum idx={idx} total={total} />
        <Tag tag={slide.tag} />
        <Text style={[S.headline, { marginBottom: 20 }]}>{slide.headline}</Text>
        {slide.steps.map(step => (
          <View key={step.num} style={S.stepRow}>
            <View style={S.stepNum}>
              <Text style={S.stepNumText}>{step.num}</Text>
            </View>
            <View style={S.stepContent}>
              <Text style={S.stepText}>{step.text}</Text>
              <Text style={S.stepTiming}>{step.timing}</Text>
            </View>
          </View>
        ))}
      </View>
    </Page>
  )
}

function ProofSlide({ slide, idx, total }: { slide: Extract<Slide, { type: 'proof' }>; idx: number; total: number }) {
  const statColor = slide.tag.color === 'green' ? C.green : C.accent
  return (
    <Page size={[540, 675]} style={S.page}>
      <TopBar color={slide.tag.color} />
      <View style={S.cornerAccent} />
      <View style={S.inner}>
        <SlideNum idx={idx} total={total} />
        <Tag tag={slide.tag} />
        <Text style={[S.statNumber, { color: statColor, fontSize: 52, marginBottom: 8 }]}>{slide.stat}</Text>
        <Text style={S.quoteText}>« {slide.quote} »</Text>
        <Text style={S.quoteSource}>{slide.source}</Text>
        <View style={{ marginTop: 16 }}>
          {slide.bullets.map((b, i) => (
            <View key={i} style={S.bulletRow}>
              <Text style={S.bulletArrow}>›</Text>
              <Text style={S.bulletText}>{b}</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  )
}

function CTASlide({ slide, idx, total }: { slide: Extract<Slide, { type: 'cta' }>; idx: number; total: number }) {
  return (
    <Page size={[540, 675]} style={S.page}>
      <TopBar color={slide.tag.color} />
      <View style={S.cornerAccent} />
      <View style={S.cornerBottomLeft} />
      <View style={S.inner}>
        <SlideNum idx={idx} total={total} />
        <Tag tag={slide.tag} />
        <HeadlineAccent
          text={slide.headline}
          accent={slide.accentPhrase}
          baseColor={C.white}
          accentColor={C.green}
          style={S.headline}
        />
        <View style={S.ctaBox}>
          <Text style={S.ctaOffer}>{slide.offer}</Text>
        </View>
        <View style={S.ctaButton}>
          <Text style={S.ctaButtonText}>{slide.button}</Text>
        </View>
        <Text style={S.ctaCredibility}>{slide.credibility}</Text>
      </View>
      <View style={S.footer}>
        <View style={S.footerDot} />
        <Text style={S.footerText}>0FLAW — CYBERSÉCURITÉ PME</Text>
        <View style={S.footerDot} />
      </View>
    </Page>
  )
}

// ─── Document ─────────────────────────────────────────────────────────────────

export function CarouselDocument({ slides }: { slides: Slide[] }) {
  const total = slides.length

  return (
    <Document>
      {slides.map((slide, i) => {
        const idx = i + 1
        if (slide.type === 'cover')   return <CoverSlide   key={i} slide={slide} idx={idx} total={total} />
        if (slide.type === 'problem') return <ProblemSlide key={i} slide={slide} idx={idx} total={total} />
        if (slide.type === 'stat')    return <StatSlide    key={i} slide={slide} idx={idx} total={total} />
        if (slide.type === 'insight') return <InsightSlide key={i} slide={slide} idx={idx} total={total} />
        if (slide.type === 'system')  return <SystemSlide  key={i} slide={slide} idx={idx} total={total} />
        if (slide.type === 'proof')   return <ProofSlide   key={i} slide={slide} idx={idx} total={total} />
        if (slide.type === 'cta')     return <CTASlide     key={i} slide={slide} idx={idx} total={total} />
        return null
      })}
    </Document>
  )
}
