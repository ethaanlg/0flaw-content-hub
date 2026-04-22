'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isPast,
  isToday,
  nextDay,
  getDay,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import LoadingSpinner from '@/components/LoadingSpinner'
import PlatformBadge from '@/components/PlatformBadge'
import type { Slide } from '@/lib/slides-gen'
import TopicLibraryPanel from '@/components/TopicLibraryPanel'
import TextPostResult from '@/components/TextPostResult'
import type { ContentType, TextPost } from '@/lib/types'

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const SUGGESTIONS = [
  'Les 7 erreurs cyber des PME en 2026',
  'Phishing IA : comment détecter les nouveaux leurres',
  'NIS2 : ce qui change pour les ETI françaises',
  'Mots de passe : les bonnes pratiques en 2026',
  'Ransomware : comment se préparer avant l\'attaque',
  'Sécurité des emails professionnels',
  'VPN en entreprise : avantages et limites',
  'La double authentification expliquée simplement',
  'RGPD & cybersécurité : les obligations des PME',
  'Sauvegardes : la règle 3-2-1 expliquée',
]

const GEN_STEPS = [
  { label: 'Claude rédige la description et les slides...', icon: '✍️' },
  { label: 'Rendu PDF en cours...', icon: '🎨' },
  { label: 'Upload terminé ✓', icon: '📄' },
]

const DAYS_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type StepNum = 1 | 2 | 3 | 4
type Variant = 'v1' | 'v2' | 'v3'
type ToastType = 'success' | 'error'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function countWords(str: string) {
  return str.trim() === '' ? 0 : str.trim().split(/\s+/).length
}

function getNextWeekday(weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6): Date {
  const today = new Date()
  const todayDay = getDay(today)
  // date-fns: 0=Sun, 1=Mon...6=Sat; we want 2=Tue(2) or 4=Thu(4)
  let diff = weekday - todayDay
  if (diff <= 0) diff += 7
  const next = new Date(today)
  next.setDate(today.getDate() + diff)
  return next
}

function buildScheduledAt(date: Date | null, time: string): string | null {
  if (!date) return null
  const [h, m] = time.split(':').map(Number)
  const d = new Date(date)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

// ─────────────────────────────────────────────
// Toast component
// ─────────────────────────────────────────────
function Toast({
  msg,
  type,
  onDismiss,
}: {
  msg: string
  type: ToastType
  onDismiss: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
          background: 'var(--bg2)',
          border: `1px solid ${type === 'success' ? 'var(--green)' : 'var(--accent2)'}`,
          borderRadius: 12,
          padding: '14px 20px',
          fontFamily: "'Space Mono', monospace",
          fontSize: 13,
          color: type === 'success' ? 'var(--green)' : 'var(--accent2)',
          boxShadow: `0 8px 32px rgba(0,0,0,0.4)`,
          animation: 'slideUp 0.25s ease',
          maxWidth: 320,
        }}
      >
        {msg}
      </div>
    </>
  )
}

// ─────────────────────────────────────────────
// Stepper visual bar
// ─────────────────────────────────────────────
const STEP_LABELS = ['Sujet', 'Génération', 'Description', 'Publication']

function StepperBar({ step }: { step: StepNum }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        marginBottom: 40,
        position: 'relative',
      }}
    >
      {STEP_LABELS.map((label, i) => {
        const num = (i + 1) as StepNum
        const isPast = num < step
        const isActive = num === step
        return (
          <div
            key={label}
            style={{ display: 'flex', alignItems: 'flex-start', flex: i < 3 ? 1 : 'none' }}
          >
            {/* Circle + label */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontFamily: "'Syne', sans-serif",
                  fontWeight: 700,
                  background: isPast
                    ? 'rgba(61,255,160,0.15)'
                    : isActive
                    ? 'rgba(79,111,255,0.2)'
                    : 'rgba(255,255,255,0.05)',
                  border: isPast
                    ? '2px solid var(--green)'
                    : isActive
                    ? '2px solid var(--accent)'
                    : '2px solid rgba(255,255,255,0.1)',
                  color: isPast ? 'var(--green)' : isActive ? 'var(--accent)' : 'var(--muted)',
                  boxShadow: isActive
                    ? '0 0 16px rgba(79,111,255,0.35)'
                    : 'none',
                  transition: 'all 0.3s ease',
                  flexShrink: 0,
                }}
              >
                {isPast ? '✓' : num}
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontFamily: "'Syne', sans-serif",
                  fontWeight: 700,
                  color: isPast
                    ? 'var(--green)'
                    : isActive
                    ? 'white'
                    : 'var(--muted)',
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.02em',
                }}
              >
                {label}
              </span>
            </div>
            {/* Connector line */}
            {i < 3 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  marginTop: 17,
                  marginLeft: 8,
                  marginRight: 8,
                  background: isPast ? 'var(--green)' : 'rgba(255,255,255,0.08)',
                  transition: 'background 0.4s ease',
                  borderRadius: 2,
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────
// Step 1 — Sujet
// ─────────────────────────────────────────────
function Step1({
  title,
  setTitle,
  topic,
  setTopic,
  platforms,
  setPlatforms,
  contentType,
  setContentType,
  showLibrary,
  setShowLibrary,
  onTopicSelect,
  onNext,
}: {
  title: string
  setTitle: (v: string) => void
  topic: string
  setTopic: (v: string) => void
  platforms: string[]
  setPlatforms: (v: string[]) => void
  contentType: ContentType
  setContentType: (v: ContentType) => void
  showLibrary: boolean
  setShowLibrary: (v: boolean) => void
  onTopicSelect: (title: string, description: string) => void
  onNext: () => void
}) {
  const canNext = title.length >= 3 && topic.length >= 3

  function togglePlatform(p: string) {
    setPlatforms(
      platforms.includes(p)
        ? platforms.filter((x) => x !== p)
        : [...platforms, p]
    )
  }

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Content type selector */}
      <div>
        <label className="section-label" style={{ display: 'block', marginBottom: 12 }}>
          Type de contenu
        </label>
        <div style={{ display: 'flex', gap: 10 }}>
          {(['carousel', 'text'] as ContentType[]).map(type => (
            <button
              key={type}
              onClick={() => setContentType(type)}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: 12,
                cursor: 'pointer',
                textAlign: 'center' as const,
                background: contentType === type ? 'rgba(79,111,255,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${contentType === type ? 'rgba(79,111,255,0.4)' : 'var(--border)'}`,
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 4 }}>{type === 'carousel' ? '📊' : '✍️'}</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>
                {type === 'carousel' ? 'Carrousel' : 'Post texte'}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                {type === 'carousel' ? '7 slides · PDF' : 'LinkedIn + caption IG'}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="section-label" style={{ display: 'block', marginBottom: 8 }}>
          Titre du post
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: 7 erreurs cyber qui coûtent cher aux PME"
          style={{
            width: '100%',
            height: 56,
            fontSize: 16,
            padding: '0 16px',
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            color: 'white',
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => (e.target.style.borderColor = 'rgba(79,111,255,0.5)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
        />
      </div>

      <div>
        <label className="section-label" style={{ display: 'block', marginBottom: 8 }}>
          Angle / contexte
        </label>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Décrivez le sujet, l'angle, l'audience cible..."
          rows={4}
          style={{
            width: '100%',
            fontSize: 14,
            padding: '14px 16px',
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            color: 'white',
            fontFamily: "'Space Mono', monospace",
            outline: 'none',
            resize: 'vertical',
            lineHeight: 1.7,
            boxSizing: 'border-box',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => (e.target.style.borderColor = 'rgba(79,111,255,0.5)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
        />
      </div>

      {/* Suggestions */}
      <div>
        <label className="section-label" style={{ display: 'block', marginBottom: 12 }}>
          Suggestions de topics cybersécurité
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SUGGESTIONS.map((s) => {
            const isSelected = topic === s
            return (
              <button
                key={s}
                onClick={() => setTopic(s)}
                style={{
                  borderRadius: 100,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontFamily: "'Space Mono', monospace",
                  cursor: 'pointer',
                  border: isSelected
                    ? '1px solid rgba(79,111,255,0.3)'
                    : '1px solid var(--border)',
                  background: isSelected
                    ? 'rgba(79,111,255,0.12)'
                    : 'rgba(255,255,255,0.06)',
                  color: isSelected ? 'white' : 'var(--muted)',
                  transition: 'all 0.15s ease',
                  lineHeight: 1.5,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    ;(e.currentTarget as HTMLButtonElement).style.background =
                      'rgba(79,111,255,0.12)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                      'rgba(79,111,255,0.3)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'white'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    ;(e.currentTarget as HTMLButtonElement).style.background =
                      'rgba(255,255,255,0.06)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                      'var(--border)'
                    ;(e.currentTarget as HTMLButtonElement).style.color =
                      'var(--muted)'
                  }
                }}
              >
                {s}
              </button>
            )
          })}
        </div>
      </div>

      {/* Platform selector */}
      <div>
        <label className="section-label" style={{ display: 'block', marginBottom: 12 }}>
          Plateformes
        </label>
        <div style={{ display: 'flex', gap: 10 }}>
          {(['linkedin', 'instagram'] as const).map((p) => {
            const active = platforms.includes(p)
            return (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                style={{
                  background: active ? 'rgba(79,111,255,0.15)' : 'rgba(255,255,255,0.05)',
                  border: active
                    ? '1px solid rgba(79,111,255,0.4)'
                    : '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '10px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: active ? '0 0 12px rgba(79,111,255,0.2)' : 'none',
                }}
              >
                <PlatformBadge platform={p} size="md" />
              </button>
            )
          })}
        </div>
      </div>

      {/* Next button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, gap: 10 }}>
        <button
          onClick={() => setShowLibrary(!showLibrary)}
          style={{
            padding: '0 20px',
            height: 48,
            borderRadius: 12,
            background: showLibrary ? 'rgba(79,111,255,0.12)' : 'rgba(255,255,255,0.05)',
            border: showLibrary ? '1px solid rgba(79,111,255,0.4)' : '1px solid var(--border)',
            fontSize: 13,
            fontWeight: 700,
            color: showLibrary ? '#7a94ff' : 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            whiteSpace: 'nowrap' as const,
          }}
        >
          📚 Topics
        </button>
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={!canNext}
          style={{ flex: 1 }}
        >
          Suivant →
        </button>
      </div>
      </div>

      {/* Topic library panel */}
      {showLibrary && (
        <TopicLibraryPanel
          onSelect={(selectedTitle, description) => {
            onTopicSelect(selectedTitle, description)
          }}
          onClose={() => setShowLibrary(false)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Step 2 — Génération
// ─────────────────────────────────────────────
function Step2({
  title,
  topic,
  contentType,
  onDone,
  onDoneText,
}: {
  title: string
  topic: string
  contentType?: ContentType
  onDone: (data: { v1: string; v2: string; v3: string; slides: Slide[]; pdfUrl: string }) => void
  onDoneText?: (data: TextPost) => void
}) {
  const [genStep, setGenStep] = useState(-1)
  const [genError, setGenError] = useState('')
  const hasRun = useRef(false)

  async function handleGenerate() {
    setGenError('')
    setGenStep(0)
    try {
      // Step 1 — Claude generates descriptions + slide content
      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, title, content_type: contentType ?? 'carousel' }),
      })
      if (!genRes.ok) throw new Error('Erreur génération')
      const genData = await genRes.json()
      if (genData.error) throw new Error(genData.error)

      if (contentType === 'text') {
        setGenStep(3)
        onDoneText?.({ linkedin: genData.linkedin, instagram: genData.instagram })
        return
      }

      setGenStep(1)

      // Step 2 — Render PDF
      const slidesRes = await fetch('/api/slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides: genData.slides }),
      })
      if (!slidesRes.ok) throw new Error('Erreur rendu PDF')
      const slidesData = await slidesRes.json()
      if (slidesData.error) throw new Error(slidesData.error)
      setGenStep(2)

      // Step 3 — Done
      setGenStep(3)
      onDone({
        v1: genData.v1,
        v2: genData.v2,
        v3: genData.v3,
        slides: genData.slides,
        pdfUrl: slidesData.pdfUrl,
      })
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : 'Erreur inconnue')
      setGenStep(-1)
    }
  }

  useEffect(() => {
    if (!hasRun.current) {
      hasRun.current = true
      handleGenerate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const progress = genStep < 0 ? 0 : Math.min((genStep / 3) * 100, 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <h2
        style={{
          fontFamily: "'Syne', sans-serif",
          fontWeight: 800,
          fontSize: 24,
          letterSpacing: '-0.02em',
          margin: 0,
        }}
      >
        Génération en cours...
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {GEN_STEPS.map((gs, i) => {
          const isDone = genStep > i
          const isActive = genStep === i
          return (
            <div
              key={gs.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '16px 20px',
                background: isActive ? 'rgba(79,111,255,0.07)' : 'rgba(255,255,255,0.03)',
                border: isActive
                  ? '1px solid rgba(79,111,255,0.2)'
                  : '1px solid var(--border)',
                borderRadius: 12,
                boxShadow: isActive ? '0 0 20px rgba(79,111,255,0.1)' : 'none',
                transition: 'all 0.3s ease',
                opacity: !isDone && !isActive && genStep >= 0 ? 0.5 : 1,
              }}
            >
              <span style={{ fontSize: 22, flexShrink: 0 }}>{gs.icon}</span>
              <span
                style={{
                  flex: 1,
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 13,
                  color: isDone ? 'var(--green)' : isActive ? 'white' : 'var(--muted)',
                }}
              >
                {gs.label}
              </span>
              <span style={{ flexShrink: 0 }}>
                {isDone ? (
                  <span
                    style={{
                      color: 'var(--green)',
                      fontSize: 16,
                      fontWeight: 700,
                    }}
                  >
                    ✓
                  </span>
                ) : isActive ? (
                  <LoadingSpinner size={18} />
                ) : (
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.1)',
                      display: 'block',
                    }}
                  />
                )}
              </span>
            </div>
          )
        })}
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 4,
          background: 'rgba(255,255,255,0.07)',
          borderRadius: 100,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: 'var(--accent)',
            borderRadius: 100,
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {genError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              color: 'var(--accent2)',
              fontFamily: "'Space Mono', monospace",
              fontSize: 13,
            }}
          >
            {genError}
          </span>
          <button className="btn btn-ghost" onClick={handleGenerate}>
            Réessayer
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Step 3 — Description
// ─────────────────────────────────────────────
function Step3({
  descriptions,
  setDescriptions,
  activeVariant,
  setActiveVariant,
  description,
  setDescription,
  pdfUrl,
  onBack,
  onNext,
}: {
  descriptions: { v1: string; v2: string; v3: string }
  setDescriptions: (v: { v1: string; v2: string; v3: string }) => void
  activeVariant: Variant
  setActiveVariant: (v: Variant) => void
  description: string
  setDescription: (v: string) => void
  pdfUrl: string
  onBack: () => void
  onNext: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [showToast, setShowToast] = useState(false)

  const TABS: { key: Variant; label: string }[] = [
    { key: 'v1', label: 'V1 — Courte' },
    { key: 'v2', label: 'V2 — Directe' },
    { key: 'v3', label: 'V3 — Maximale' },
  ]

  function handleCopy() {
    navigator.clipboard.writeText(descriptions[activeVariant])
    setCopied(true)
    setShowToast(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleChange(val: string) {
    setDescriptions({ ...descriptions, [activeVariant]: val })
    if (activeVariant === activeVariant) setDescription(val)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* PDF preview banner */}
      {pdfUrl && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'rgba(61,255,160,0.06)',
          border: '1px solid rgba(61,255,160,0.2)',
          borderRadius: 12,
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>📄</span>
            <span style={{
              fontSize: 12,
              fontFamily: "'Space Mono', monospace",
              color: 'var(--green)',
              fontWeight: 700,
            }}>
              Carrousel généré ✓
            </span>
          </div>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: '6px 14px', textDecoration: 'none' }}
          >
            Voir le PDF →
          </a>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setActiveVariant(t.key)
              setDescription(descriptions[t.key])
            }}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 12,
              fontFamily: "'Syne', sans-serif",
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              background:
                activeVariant === t.key ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
              color: activeVariant === t.key ? 'white' : 'var(--muted)',
              transition: 'all 0.2s ease',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Textarea */}
      <div style={{ position: 'relative' }}>
        <textarea
          value={descriptions[activeVariant]}
          onChange={(e) => handleChange(e.target.value)}
          rows={12}
          style={{
            width: '100%',
            fontSize: 13,
            padding: '16px',
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            color: 'white',
            fontFamily: "'Space Mono', monospace",
            outline: 'none',
            resize: 'vertical',
            lineHeight: 1.75,
            boxSizing: 'border-box',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => (e.target.style.borderColor = 'rgba(79,111,255,0.5)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            fontSize: 11,
            fontFamily: "'Space Mono', monospace",
            color: 'var(--muted)',
          }}
        >
          {countWords(descriptions[activeVariant])} mots
        </div>
      </div>

      {/* Copy button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={handleCopy} style={{ fontSize: 12 }}>
          {copied ? 'Copié ✓' : 'Copier'}
        </button>
      </div>

      {/* Nav buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <button className="btn btn-ghost" onClick={onBack}>
          ← Retour
        </button>
        <button className="btn btn-primary" onClick={onNext}>
          Suivant →
        </button>
      </div>

      {showToast && (
        <Toast
          msg="Copié dans le presse-papier ✓"
          type="success"
          onDismiss={() => setShowToast(false)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Mini Calendar (Step 4)
// ─────────────────────────────────────────────
function MiniCalendar({
  selectedDate,
  onSelect,
}: {
  selectedDate: Date | null
  onSelect: (d: Date) => void
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  function isRecommended(d: Date) {
    const dow = getDay(d) // 0=Sun,2=Tue,4=Thu
    return dow === 2 || dow === 4
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <button
          className="btn btn-ghost"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          style={{ padding: '4px 10px', fontSize: 14 }}
        >
          ←
        </button>
        <span
          style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            fontSize: 14,
            textTransform: 'capitalize',
          }}
        >
          {format(currentMonth, 'MMMM yyyy', { locale: fr })}
        </span>
        <button
          className="btn btn-ghost"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          style={{ padding: '4px 10px', fontSize: 14 }}
        >
          →
        </button>
      </div>

      {/* Day headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 2,
          marginBottom: 4,
        }}
      >
        {DAYS_LABELS.map((d) => (
          <div
            key={d}
            style={{
              textAlign: 'center',
              fontSize: 10,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.3)',
              padding: '6px 0',
              fontFamily: "'Space Mono', monospace",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {days.map((day) => {
          const inMonth = isSameMonth(day, currentMonth)
          const isPastDay = isPast(day) && !isToday(day)
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
          const recommended = isRecommended(day)
          const todayDay = isToday(day)

          return (
            <div
              key={day.toISOString()}
              onClick={() => {
                if (!isPastDay && inMonth) onSelect(day)
              }}
              style={{
                position: 'relative',
                minHeight: 38,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                cursor: isPastDay || !inMonth ? 'default' : 'pointer',
                opacity: isPastDay || !inMonth ? 0.3 : 1,
                background: isSelected
                  ? 'var(--accent)'
                  : recommended && inMonth && !isPastDay
                  ? 'rgba(61,255,160,0.08)'
                  : todayDay
                  ? 'rgba(79,111,255,0.08)'
                  : 'rgba(255,255,255,0.03)',
                border: isSelected
                  ? '1px solid var(--accent)'
                  : recommended && inMonth && !isPastDay
                  ? '1px solid rgba(61,255,160,0.25)'
                  : todayDay
                  ? '1px solid rgba(79,111,255,0.2)'
                  : '1px solid transparent',
                transition: 'all 0.15s ease',
                fontSize: 12,
                fontFamily: "'Syne', sans-serif",
                fontWeight: 700,
                color: isSelected ? 'white' : todayDay ? '#7a94ff' : 'rgba(255,255,255,0.7)',
              }}
            >
              {recommended && inMonth && !isPastDay && !isSelected && (
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: 3,
                    fontSize: 8,
                    color: 'var(--green)',
                    lineHeight: 1,
                  }}
                >
                  ★
                </span>
              )}
              {format(day, 'd')}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Step 4 — Publication
// ─────────────────────────────────────────────
function Step4({
  platforms,
  selectedDate,
  setSelectedDate,
  scheduledAt,
  setScheduledAt,
  pdfUrl,
  setPdfUrl,
  saving,
  savedId,
  onBack,
  onSave,
  onReset,
}: {
  platforms: string[]
  selectedDate: Date | null
  setSelectedDate: (d: Date | null) => void
  scheduledAt: string | null
  setScheduledAt: (v: string | null) => void
  pdfUrl: string
  setPdfUrl: (v: string) => void
  saving: boolean
  savedId: string | null
  onBack: () => void
  onSave: (status: 'draft' | 'scheduled') => void
  onReset: () => void
}) {
  const [time, setTime] = useState('08:15')

  // Generate half-hour slots 06:00–22:00
  const TIME_SLOTS: string[] = []
  for (let h = 6; h <= 22; h++) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`)
    if (h < 22) TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`)
  }

  function handleDateSelect(d: Date) {
    setSelectedDate(d)
    const dow = getDay(d)
    const defaultTime = dow === 2 || dow === 4 ? '08:15' : '10:00'
    setTime(defaultTime)
    setScheduledAt(buildScheduledAt(d, defaultTime))
  }

  function handleTimeChange(t: string) {
    setTime(t)
    setScheduledAt(buildScheduledAt(selectedDate, t))
  }

  function selectNextSlot(weekday: 2 | 4) {
    const next = getNextWeekday(weekday)
    setSelectedDate(next)
    setTime('08:15')
    setScheduledAt(buildScheduledAt(next, '08:15'))
  }

  if (savedId) {
    return (
      <div
        className="card"
        style={{
          textAlign: 'center',
          padding: '48px 32px',
          border: '1px solid rgba(61,255,160,0.25)',
          background: 'rgba(61,255,160,0.04)',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h2
          style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800,
            fontSize: 24,
            marginBottom: 8,
            color: 'var(--green)',
          }}
        >
          Post programmé ✓
        </h2>
        <p
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 12,
            color: 'var(--muted)',
            marginBottom: 24,
          }}
        >
          ID: {savedId}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/calendar" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
            Voir dans le calendrier →
          </Link>
          <button className="btn btn-primary" onClick={onReset}>
            Créer un autre post
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 2-col layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 24,
          alignItems: 'start',
        }}
      >
        {/* Calendar */}
        <div className="card" style={{ padding: '20px' }}>
          <MiniCalendar selectedDate={selectedDate} onSelect={handleDateSelect} />
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Time selector */}
          <div>
            <label className="section-label" style={{ display: 'block', marginBottom: 8 }}>
              Heure de publication
            </label>
            <select
              value={time}
              onChange={(e) => handleTimeChange(e.target.value)}
              style={{
                width: '100%',
                height: 44,
                padding: '0 12px',
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                color: 'white',
                fontFamily: "'Space Mono', monospace",
                fontSize: 13,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {TIME_SLOTS.map((t) => (
                <option key={t} value={t} style={{ background: '#1a1f36' }}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Recommended slots */}
          <div>
            <label className="section-label" style={{ display: 'block', marginBottom: 10 }}>
              Créneaux recommandés
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: 'Mardi 08h15 ★', weekday: 2 as const },
                { label: 'Jeudi 08h15 ★', weekday: 4 as const },
              ].map((slot) => (
                <button
                  key={slot.label}
                  onClick={() => selectNextSlot(slot.weekday)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 100,
                    fontSize: 12,
                    fontFamily: "'Space Mono', monospace",
                    cursor: 'pointer',
                    border: '1px solid rgba(61,255,160,0.3)',
                    background: 'rgba(61,255,160,0.08)',
                    color: 'var(--green)',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.background =
                      'rgba(61,255,160,0.15)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.background =
                      'rgba(61,255,160,0.08)'
                  }}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>

          {/* PDF auto-généré */}
          <div>
            <label className="section-label" style={{ display: 'block', marginBottom: 8 }}>
              Carrousel PDF
            </label>
            {pdfUrl ? (
              <div style={{
                padding: '12px 14px',
                background: 'rgba(61,255,160,0.06)',
                border: '1px solid rgba(61,255,160,0.2)',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>📄</span>
                  <span style={{
                    fontSize: 11,
                    fontFamily: "'Space Mono', monospace",
                    color: 'var(--green)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    Carrousel prêt
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: '5px 12px', textDecoration: 'none' }}
                  >
                    Ouvrir
                  </a>
                </div>
              </div>
            ) : (
              <div style={{
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                fontSize: 12,
                color: 'var(--muted)',
                fontFamily: "'Space Mono', monospace",
              }}>
                Aucun PDF généré
              </div>
            )}
            {platforms.includes('linkedin') && !pdfUrl && (
              <p style={{
                marginTop: 8, fontSize: 12,
                color: 'var(--accent2)',
                fontFamily: "'Space Mono', monospace",
              }}>
                ⚠ Le PDF est requis pour LinkedIn. Relancez la génération à l&apos;étape 2.
              </p>
            )}
          </div>

          {/* Selected date info */}
          {selectedDate && (
            <div
              style={{
                padding: '12px 16px',
                background: 'rgba(79,111,255,0.07)',
                border: '1px solid rgba(79,111,255,0.15)',
                borderRadius: 10,
                fontFamily: "'Space Mono', monospace",
                fontSize: 12,
                color: '#7a94ff',
              }}
            >
              📅 {format(selectedDate, 'EEEE d MMMM', { locale: fr })} à {time}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 8,
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <button className="btn btn-ghost" onClick={onBack} disabled={saving}>
          ← Retour
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-ghost"
            onClick={() => onSave('draft')}
            disabled={saving}
          >
            {saving ? <LoadingSpinner size={14} /> : 'Sauvegarder brouillon'}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onSave('scheduled')}
            disabled={saving || !scheduledAt || (platforms.includes('linkedin') && !pdfUrl)}
            title={platforms.includes('linkedin') && !pdfUrl ? 'PDF carrousel requis pour publier sur LinkedIn' : undefined}
            style={{
              opacity: (!scheduledAt || (platforms.includes('linkedin') && !pdfUrl)) ? 0.4 : 1,
              cursor: (!scheduledAt || (platforms.includes('linkedin') && !pdfUrl)) ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? <LoadingSpinner size={14} /> : '📅 Programmer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────
export default function CreatePage() {
  const [step, setStep] = useState<StepNum>(1)

  // Step 1
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [platforms, setPlatforms] = useState<string[]>(['linkedin'])

  // Step 2
  const [descriptions, setDescriptions] = useState<{
    v1: string
    v2: string
    v3: string
  } | null>(null)
  const [slides, setSlides] = useState<Slide[]>([])

  // Step 3
  const [activeVariant, setActiveVariant] = useState<Variant>('v3')
  const [description, setDescription] = useState('')

  // Step 4
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [scheduledAt, setScheduledAt] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)

  // Content type + library
  const [contentType, setContentType] = useState<ContentType>('carousel')
  const [showLibrary, setShowLibrary] = useState(false)
  const [textPost, setTextPost] = useState<TextPost | null>(null)

  // Global
  const [error, setError] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null)

  function showToast(msg: string, type: ToastType) {
    setToast({ msg, type })
  }

  async function handleSave(status: 'draft' | 'scheduled') {
    setSaving(true)
    setError('')
    try {
      const { data, error: sbError } = await supabase
        .from('posts')
        .insert({
          title,
          topic,
          description,
          status,
          platforms,
          scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          pdf_url: pdfUrl || null,
        })
        .select()
        .single()

      if (sbError) throw sbError
      setSavedId(data.id)
      showToast(
        status === 'scheduled' ? 'Post programmé avec succès ✓' : 'Brouillon sauvegardé ✓',
        'success'
      )
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur lors de la sauvegarde'
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setStep(1)
    setTitle('')
    setTopic('')
    setPlatforms(['linkedin'])
    setDescriptions(null)
    setSlides([])
    setActiveVariant('v3')
    setDescription('')
    setSelectedDate(null)
    setScheduledAt(null)
    setPdfUrl('')
    setSaving(false)
    setSavedId(null)
    setError('')
    setContentType('carousel')
    setShowLibrary(false)
    setTextPost(null)
  }

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .create-container {
            padding: 24px 16px !important;
          }
        }
      `}</style>

      <div
        className="create-container"
        style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}
      >
        {/* Page title */}
        <h1
          style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800,
            fontSize: 32,
            letterSpacing: '-0.02em',
            marginBottom: 32,
          }}
        >
          Créer un post
        </h1>

        {/* Stepper */}
        <StepperBar step={step} />

        {/* Error */}
        {error && (
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(255,79,111,0.08)',
              border: '1px solid rgba(255,79,111,0.3)',
              borderRadius: 10,
              color: 'var(--accent2)',
              fontFamily: "'Space Mono', monospace",
              fontSize: 12,
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        {/* Steps */}
        {step === 1 && (
          <Step1
            title={title}
            setTitle={setTitle}
            topic={topic}
            setTopic={setTopic}
            platforms={platforms}
            setPlatforms={setPlatforms}
            contentType={contentType}
            setContentType={setContentType}
            showLibrary={showLibrary}
            setShowLibrary={setShowLibrary}
            onTopicSelect={(selectedTitle, description) => {
              setTitle(selectedTitle)
              setTopic(description)
            }}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <Step2
            title={title}
            topic={topic}
            contentType={contentType}
            onDone={(data) => {
              setDescriptions({ v1: data.v1, v2: data.v2, v3: data.v3 })
              setSlides(data.slides)
              setPdfUrl(data.pdfUrl)
              setDescription(data.v3)
              setActiveVariant('v3')
              setStep(3)
            }}
            onDoneText={(data) => {
              setTextPost(data)
              setStep(3)
            }}
          />
        )}

        {step === 3 && contentType === 'text' && textPost && (
          <TextPostResult
            textPost={textPost}
            topic={topic}
            title={title}
            onRegenerate={async () => {
              const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, title, content_type: 'text' }),
              })
              const data = await res.json()
              if (!res.ok) throw new Error(data.error ?? 'Erreur régénération')
              if (data.linkedin && data.instagram) {
                setTextPost({ linkedin: data.linkedin, instagram: data.instagram })
              }
            }}
          />
        )}

        {step === 3 && contentType === 'carousel' && descriptions && (
          <Step3
            descriptions={descriptions}
            setDescriptions={setDescriptions}
            activeVariant={activeVariant}
            setActiveVariant={setActiveVariant}
            description={description}
            setDescription={setDescription}
            pdfUrl={pdfUrl}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}

        {step === 4 && (
          <Step4
            platforms={platforms}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            scheduledAt={scheduledAt}
            setScheduledAt={setScheduledAt}
            pdfUrl={pdfUrl}
            setPdfUrl={setPdfUrl}
            saving={saving}
            savedId={savedId}
            onBack={() => setStep(3)}
            onSave={handleSave}
            onReset={handleReset}
          />
        )}
      </div>

      {/* Global toast */}
      {toast && (
        <Toast
          msg={toast.msg}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  )
}
