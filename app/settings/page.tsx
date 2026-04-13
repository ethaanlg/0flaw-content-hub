'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Settings } from '@/lib/types'

const DEFAULT: Settings = {
  weekGoal: 2,
  optimalDays: [2, 4],
  optimalHour: 8,
  defaultPlatforms: ['linkedin', 'instagram'],
  aiModel: 'claude-sonnet-4-6',
  linkedinConnected: false,
  instagramConnected: false,
}

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 32,
      right: 32,
      zIndex: 100,
      background: 'rgba(61,255,160,0.15)',
      border: '1px solid rgba(61,255,160,0.35)',
      color: 'var(--green)',
      padding: '12px 20px',
      borderRadius: 12,
      fontSize: 13,
      fontWeight: 700,
      fontFamily: 'Space Mono, monospace',
      letterSpacing: '0.05em',
      transition: 'opacity 0.3s, transform 0.3s',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(8px)',
      pointerEvents: 'none',
    }}>
      ✓ {message}
    </div>
  )
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span className="section-label">{title}</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {children}
      </div>
    </div>
  )
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: sub ? 3 : 0 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{sub}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>
        {children}
      </div>
    </div>
  )
}

// ─── Toggle ──────────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        border: 'none',
        background: value ? 'var(--accent)' : 'rgba(255,255,255,0.12)',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 3,
        left: value ? 23 : 3,
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
        display: 'block',
      }} />
    </button>
  )
}

// ─── PlatformStatus ───────────────────────────────────────────────────────────

function PlatformStatus({ name, connected, color, onToggle }: {
  name: string
  connected: boolean
  color: string
  onToggle: () => void
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 16px',
      borderRadius: 12,
      background: connected ? `${color}10` : 'rgba(255,255,255,0.04)',
      border: `1px solid ${connected ? color + '30' : 'rgba(255,255,255,0.07)'}`,
      transition: 'all 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: connected ? `${color}20` : 'rgba(255,255,255,0.06)',
          border: `1px solid ${connected ? color + '35' : 'rgba(255,255,255,0.08)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
        }}>
          {name === 'LinkedIn' ? '💼' : '📸'}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{name}</div>
          <div style={{ fontSize: 11, color: connected ? color : 'rgba(255,255,255,0.3)', marginTop: 2 }}>
            {connected ? 'Connecté' : 'Non connecté'}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {connected && (
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--green)',
            boxShadow: '0 0 8px rgba(61,255,160,0.6)',
            display: 'inline-block',
          }} />
        )}
        <button
          onClick={onToggle}
          className={connected ? 'btn btn-danger' : 'btn btn-ghost'}
          style={{ fontSize: 11, padding: '6px 14px' }}
        >
          {connected ? 'Déconnecter' : 'Connecter'}
        </button>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT)
  const [toast, setToast] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  // Charger depuis Supabase au mount
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data) {
        setSettings({
          weekGoal: data.week_goal,
          optimalDays: data.optimal_days,
          optimalHour: data.optimal_hour,
          defaultPlatforms: data.default_platforms,
          aiModel: data.ai_model,
          linkedinConnected: data.linkedin_connected,
          instagramConnected: data.instagram_connected,
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function toggleDay(day: number) {
    const days = settings.optimalDays.includes(day)
      ? settings.optimalDays.filter(d => d !== day)
      : [...settings.optimalDays, day]
    update('optimalDays', days)
  }

  function togglePlatform(p: string) {
    const plats = settings.defaultPlatforms.includes(p)
      ? settings.defaultPlatforms.filter(x => x !== p)
      : [...settings.defaultPlatforms, p]
    update('defaultPlatforms', plats)
  }

  async function save() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('user_settings').upsert({
      user_id: user.id,
      week_goal: settings.weekGoal,
      optimal_days: settings.optimalDays,
      optimal_hour: settings.optimalHour,
      default_platforms: settings.defaultPlatforms,
      ai_model: settings.aiModel,
      linkedin_connected: settings.linkedinConnected,
      instagram_connected: settings.instagramConnected,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    setSaved(true)
    setToast(true)
    setTimeout(() => setToast(false), 2500)
  }

  async function handleReset() {
    if (!window.confirm('Réinitialiser tous les paramètres ?')) return
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('user_settings').delete().eq('user_id', user.id)
    }
    setSettings(DEFAULT)
    setSaved(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Chargement...</div>
    </div>
  )

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 24px 80px' }}>

      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', marginBottom: 6 }}>
          Paramètres
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
          Configuration de ton Content Hub
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

        {/* ── Connexions ── */}
        <Section title="Connexions">
          <PlatformStatus
            name="LinkedIn"
            connected={settings.linkedinConnected}
            color="#4da3d4"
            onToggle={() => update('linkedinConnected', !settings.linkedinConnected)}
          />
          <PlatformStatus
            name="Instagram"
            connected={settings.instagramConnected}
            color="#e1306c"
            onToggle={() => update('instagramConnected', !settings.instagramConnected)}
          />
        </Section>

        {/* ── Planification ── */}
        <Section title="Planification">
          <Row label="Objectif hebdomadaire" sub="Nombre de posts par semaine">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                className="btn btn-ghost"
                style={{ padding: '4px 12px', fontSize: 16, lineHeight: 1 }}
                onClick={() => update('weekGoal', Math.max(1, settings.weekGoal - 1))}
              >
                −
              </button>
              <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, minWidth: 28, textAlign: 'center' }}>
                {settings.weekGoal}
              </span>
              <button
                className="btn btn-ghost"
                style={{ padding: '4px 12px', fontSize: 16, lineHeight: 1 }}
                onClick={() => update('weekGoal', Math.min(14, settings.weekGoal + 1))}
              >
                +
              </button>
            </div>
          </Row>

          <Row label="Jours optimaux" sub="Mis en évidence dans le calendrier">
            <div style={{ display: 'flex', gap: 6 }}>
              {DAY_LABELS.map((label, i) => {
                const active = settings.optimalDays.includes(i)
                return (
                  <button
                    key={i}
                    onClick={() => toggleDay(i)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      border: `1px solid ${active ? 'rgba(61,255,160,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      background: active ? 'rgba(61,255,160,0.12)' : 'rgba(255,255,255,0.04)',
                      color: active ? 'var(--green)' : 'rgba(255,255,255,0.4)',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </Row>

          <Row label="Heure optimale" sub="Heure de publication recommandée">
            <select
              value={settings.optimalHour}
              onChange={e => update('optimalHour', parseInt(e.target.value))}
              style={{ width: 120 }}
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, '0')}h00
                </option>
              ))}
            </select>
          </Row>

          <Row label="Plateformes par défaut" sub="Pré-sélectionnées à la création">
            <div style={{ display: 'flex', gap: 8 }}>
              {(['linkedin', 'instagram'] as const).map(p => {
                const active = settings.defaultPlatforms.includes(p)
                const color = p === 'linkedin' ? '#4da3d4' : '#e1306c'
                return (
                  <button
                    key={p}
                    onClick={() => togglePlatform(p)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 100,
                      border: `1px solid ${active ? color + '50' : 'rgba(255,255,255,0.08)'}`,
                      background: active ? color + '18' : 'rgba(255,255,255,0.04)',
                      color: active ? color : 'rgba(255,255,255,0.35)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      fontFamily: 'inherit',
                      textTransform: 'capitalize',
                    }}
                  >
                    {p === 'linkedin' ? 'LinkedIn' : 'Instagram'}
                  </button>
                )
              })}
            </div>
          </Row>
        </Section>

        {/* ── Génération IA ── */}
        <Section title="Génération IA">
          <Row label="Modèle Claude" sub="Utilisé pour la génération de descriptions">
            <select
              value={settings.aiModel}
              onChange={e => update('aiModel', e.target.value)}
              style={{ width: 220 }}
            >
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (défaut)</option>
              <option value="claude-opus-4-6">Claude Opus 4.6 (premium)</option>
              <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (rapide)</option>
            </select>
          </Row>

          <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(79,111,255,0.06)', border: '1px solid rgba(79,111,255,0.15)' }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
              Le modèle sélectionné sera utilisé via l'API <code style={{ color: '#7a94ff', fontSize: 11 }}>OPENAI_API_KEY</code> configurée dans les variables d'environnement.
            </p>
          </div>
        </Section>

        {/* ── Danger zone ── */}
        <Section title="Danger Zone">
          <Row label="Réinitialiser les paramètres" sub="Remet tous les réglages à leurs valeurs par défaut">
            <button
              className="btn btn-danger"
              style={{ fontSize: 12 }}
              onClick={() => handleReset()}
            >
              Réinitialiser
            </button>
          </Row>
        </Section>

      </div>

      {/* Save bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 'var(--sidebar-w)',
        right: 0,
        padding: '16px 32px',
        background: 'rgba(15,18,37,0.92)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 12,
        zIndex: 40,
        transition: 'left 0.25s ease',
      }}>
        {saved && (
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            Paramètres sauvegardés
          </span>
        )}
        <button className="btn btn-primary" onClick={save}>
          Sauvegarder
        </button>
      </div>

      <Toast message="Paramètres sauvegardés" visible={toast} />
    </div>
  )
}
