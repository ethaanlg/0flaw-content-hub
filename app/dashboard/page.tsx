'use client'

import { useEffect, useState, useRef } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO, differenceInSeconds, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import StatCard from '@/components/StatCard'
import EmptyState from '@/components/EmptyState'
import type { Post } from '@/lib/types'

// ─── Types ───────────────────────────────────────────────────────────────────

type StatsResponse = {
  aggregated: {
    linkedin?: { reach?: number; impressions?: number; avg_engagement_rate?: number }
    instagram?: { reach?: number; impressions?: number; avg_engagement_rate?: number }
  }
  bestHours: { hour: number; avg_engagement_rate: number; sample_count: number }[]
}

type WeekPoint = { date: string; linkedin: number; instagram: number }

// ─── SVG Icons ───────────────────────────────────────────────────────────────

const IconCalendar = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} stroke="currentColor" fill="none" strokeWidth={1.5}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
  </svg>
)

const IconUsers = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} stroke="currentColor" fill="none" strokeWidth={1.5}>
    <circle cx="9" cy="7" r="4" />
    <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" strokeLinecap="round" />
    <path d="M16 3.13a4 4 0 010 7.75M21 21v-2a4 4 0 00-3-3.87" strokeLinecap="round" />
  </svg>
)

const IconZap = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} stroke="currentColor" fill="none" strokeWidth={1.5}>
    <path d="M13 2L4.09 12.96A1 1 0 005 14.5h6.5L10 22l9.91-10.96A1 1 0 0019 9.5H12.5L13 2z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const IconClock = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} stroke="currentColor" fill="none" strokeWidth={1.5}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" strokeLinecap="round" />
  </svg>
)

// ─── Platform Badge ───────────────────────────────────────────────────────────

function PlatformBadge({ platform }: { platform: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    linkedin: { bg: 'rgba(77,163,212,0.15)', color: '#4da3d4' },
    instagram: { bg: 'rgba(225,48,108,0.15)', color: '#e1306c' },
  }
  const c = colors[platform.toLowerCase()] ?? { bg: 'rgba(255,255,255,0.08)', color: 'var(--muted)' }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '999px',
      fontSize: '11px',
      fontFamily: 'Space Mono, monospace',
      fontWeight: 700,
      background: c.bg,
      color: c.color,
      textTransform: 'capitalize',
      letterSpacing: '0.05em',
    }}>
      {platform}
    </span>
  )
}

// ─── Tooltip recharts ─────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { color: string; name: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1a1f36',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '10px',
      padding: '10px 14px',
      fontFamily: 'Space Mono, monospace',
      fontSize: '12px',
    }}>
      <div style={{ color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>{p.name}:</span>
          <span style={{ color: '#fff', fontWeight: 700 }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildWeekData(posts: Post[]): WeekPoint[] {
  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }) // Monday
  const dayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

  return dayLabels.map((label, i) => {
    const day = addDays(weekStart, i)
    const dayStr = format(day, 'yyyy-MM-dd')

    let linkedin = 0
    let instagram = 0

    for (const post of posts) {
      const pubDate = post.published_at ?? post.updated_at
      if (!pubDate) continue
      const d = format(parseISO(pubDate), 'yyyy-MM-dd')
      if (d === dayStr) {
        if (post.platforms.includes('linkedin')) linkedin += 1
        if (post.platforms.includes('instagram')) instagram += 1
      }
    }

    return { date: label, linkedin, instagram }
  })
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '0s'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (days >= 1) return `${days}j ${hours}h ${mins}m`
  return `${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [scheduledPosts, setScheduledPosts] = useState<Post[]>([])
  const [publishedPosts, setPublishedPosts] = useState<Post[]>([])
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [countdown, setCountdown] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [scheduledRes, statsRes, publishedRes] = await Promise.all([
          fetch('/api/posts?status=scheduled'),
          fetch('/api/stats'),
          fetch('/api/posts?status=published'),
        ])
        const [scheduledData, statsData, publishedData] = await Promise.all([
          scheduledRes.json(),
          statsRes.json(),
          publishedRes.json(),
        ])
        setScheduledPosts(scheduledData.posts ?? [])
        setStats(statsData)
        setPublishedPosts(publishedData.posts ?? [])
      } catch (e) {
        console.error('Dashboard fetch error:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Countdown interval ────────────────────────────────────────────────────
  const nextPost = scheduledPosts
    .filter((p) => p.scheduled_at && new Date(p.scheduled_at) > new Date())
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())[0] ?? null

  useEffect(() => {
    if (!nextPost?.scheduled_at) {
      setCountdown('')
      return
    }
    const tick = () => {
      const diff = differenceInSeconds(new Date(nextPost.scheduled_at!), new Date())
      setCountdown(diff > 0 ? formatCountdown(diff) : 'Imminent')
    }
    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [nextPost])

  // ── Computed values ───────────────────────────────────────────────────────
  const now = new Date()

  const postsThisMonth = publishedPosts.filter((p) => {
    const d = p.published_at ?? p.updated_at
    if (!d) return false
    return isWithinInterval(parseISO(d), { start: startOfMonth(now), end: endOfMonth(now) })
  }).length

  const postsThisWeek = publishedPosts.filter((p) => {
    const d = p.published_at ?? p.updated_at
    if (!d) return false
    return isWithinInterval(parseISO(d), {
      start: startOfWeek(now, { weekStartsOn: 1 }),
      end: endOfWeek(now, { weekStartsOn: 1 }),
    })
  }).length

  const liReach = stats?.aggregated?.linkedin?.reach ?? 0
  const igReach = stats?.aggregated?.instagram?.reach ?? 0
  const totalReach = liReach + igReach

  const liEng = stats?.aggregated?.linkedin?.avg_engagement_rate ?? 0
  const igEng = stats?.aggregated?.instagram?.avg_engagement_rate ?? 0
  const avgEngagement = liEng > 0 && igEng > 0
    ? +((liEng + igEng) / 2).toFixed(1)
    : liEng > 0 ? +liEng.toFixed(1) : +igEng.toFixed(1)

  const hoursUntilNext = nextPost?.scheduled_at
    ? Math.max(0, Math.floor(differenceInSeconds(new Date(nextPost.scheduled_at), now) / 3600))
    : null

  const weekData = buildWeekData(publishedPosts)

  // ── Radial progress ───────────────────────────────────────────────────────
  const weekGoal = 2
  const weekProgress = Math.min(postsThisWeek / weekGoal, 1)
  const radius = 48
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - weekProgress)

  // ── Date header ───────────────────────────────────────────────────────────
  const todayLabel = format(now, "EEEE d MMMM yyyy", { locale: fr })
  const todayCapitalized = todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)

  // ── Next post formatted date ──────────────────────────────────────────────
  const nextPostDateLabel = nextPost?.scheduled_at
    ? (() => {
        const d = parseISO(nextPost.scheduled_at)
        const day = format(d, "EEEE d MMM", { locale: fr })
        const time = format(d, "HH'h'mm")
        return `${day.charAt(0).toUpperCase() + day.slice(1)} · ${time}`
      })()
    : ''

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', padding: '32px 24px 64px' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 800,
          fontSize: 28,
          color: '#fff',
          lineHeight: 1.1,
          marginBottom: 6,
        }}>
          Bonjour Ethan 👋
        </h1>
        <p style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: 13,
          color: 'var(--muted)',
          textTransform: 'capitalize',
        }}>
          {todayCapitalized}
        </p>
      </div>

      {/* ── Section 1 — 4 StatCards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 36,
      }}>
        <StatCard
          icon={<IconCalendar />}
          label="Posts ce mois"
          value={loading ? 0 : postsThisMonth}
          color="var(--accent)"
          loading={loading}
        />
        <StatCard
          icon={<IconUsers />}
          label="Reach total"
          value={loading ? 0 : totalReach}
          unit="vues"
          color="#7a94ff"
          loading={loading}
        />
        <StatCard
          icon={<IconZap />}
          label="Engagement moyen"
          value={loading ? 0 : avgEngagement}
          unit="%"
          color="var(--green)"
          loading={loading}
        />
        <StatCard
          icon={<IconClock />}
          label="Prochain post dans"
          value={loading ? 0 : hoursUntilNext !== null ? hoursUntilNext : '—'}
          unit={hoursUntilNext !== null ? 'h' : undefined}
          color="var(--accent2)"
          loading={loading}
        />
      </div>

      {/* ── Section 2 — Prochain post programmé ── */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span className="section-label">Prochain post programmé</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {loading ? (
          <div className="skeleton" style={{ height: 80, borderRadius: 12 }} />
        ) : nextPost ? (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: 16,
                color: '#fff',
                flex: 1,
                minWidth: 0,
              }}>
                {nextPost.title}
              </span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 10px',
                borderRadius: 999,
                fontSize: 11,
                fontFamily: 'Space Mono, monospace',
                fontWeight: 700,
                background: 'rgba(255,183,77,0.12)',
                color: '#ffb74d',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}>
                Programmé
              </span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {nextPost.platforms.map((p) => <PlatformBadge key={p} platform={p} />)}
              </div>
            </div>

            {/* Date */}
            <div style={{
              fontFamily: 'Space Mono, monospace',
              fontSize: 12,
              color: 'var(--muted)',
            }}>
              {nextPostDateLabel}
            </div>

            {/* Countdown live */}
            <div style={{
              fontFamily: 'Space Mono, monospace',
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--accent)',
              letterSpacing: '0.05em',
              marginTop: 4,
            }}>
              {countdown}
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <EmptyState
              icon="calendar"
              title="Aucun post programmé"
              subtitle="Crée et programme ton prochain contenu"
              cta={{ label: 'Créer un post', href: '/create' }}
            />
          </div>
        )}
      </div>

      {/* ── Section 3 & 4 wrapper (responsive) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

        {/* ── Section 3 — Sparkline semaine ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span className="section-label">Performance cette semaine</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {loading ? (
            <div className="skeleton" style={{ height: 80, borderRadius: 12 }} />
          ) : (
            <div className="card">
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={weekData} margin={{ top: 8, right: 16, bottom: 0, left: -20 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11, fontFamily: 'Space Mono, monospace' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'Space Mono, monospace' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{
                      fontFamily: 'Space Mono, monospace',
                      fontSize: 11,
                      paddingTop: 8,
                      color: 'var(--muted)',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="linkedin"
                    name="LinkedIn"
                    stroke="#4da3d4"
                    strokeWidth={2}
                    dot={{ fill: '#4da3d4', r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="instagram"
                    name="Instagram"
                    stroke="#e1306c"
                    strokeWidth={2}
                    dot={{ fill: '#e1306c', r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ── Section 4 — Actions rapides + Objectif hebdo ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span className="section-label">Actions rapides</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <div style={{
            display: 'flex',
            gap: 24,
            flexWrap: 'wrap',
            alignItems: 'flex-start',
          }}>
            {/* Actions */}
            <div className="card" style={{ flex: 1, minWidth: 220 }}>
              {loading ? (
                <>
                  <div className="skeleton" style={{ height: 80, borderRadius: 10 }} />
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <a href="/create" className="btn btn-primary" style={{ justifyContent: 'center' }}>
                    ⚡ Nouveau carrousel
                  </a>
                  <a href="/calendar" className="btn btn-ghost" style={{ justifyContent: 'center' }}>
                    📅 Voir le calendrier
                  </a>
                  <a href="/analytics" className="btn btn-ghost" style={{ justifyContent: 'center' }}>
                    📊 Voir les stats
                  </a>
                </div>
              )}
            </div>

            {/* Radial progress */}
            <div className="card" style={{
              width: 220,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}>
              {loading ? (
                <div className="skeleton" style={{ height: 80, borderRadius: 10, width: '100%' }} />
              ) : (
                <>
                  <span style={{
                    fontSize: 11,
                    fontFamily: 'Space Mono, monospace',
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    color: 'var(--muted)',
                  }}>
                    Objectif semaine
                  </span>
                  <svg width={120} height={120} viewBox="0 0 120 120">
                    {/* background ring */}
                    <circle
                      cx={60} cy={60} r={radius}
                      fill="none"
                      stroke="rgba(255,255,255,0.07)"
                      strokeWidth={10}
                    />
                    {/* progress ring */}
                    <circle
                      cx={60} cy={60} r={radius}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth={10}
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashOffset}
                      transform="rotate(-90 60 60)"
                      style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)' }}
                    />
                    {/* center text */}
                    <text
                      x={60} y={56}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      style={{
                        fontFamily: 'Syne, sans-serif',
                        fontWeight: 800,
                        fontSize: 22,
                        fill: '#fff',
                      }}
                    >
                      {postsThisWeek}
                    </text>
                    <text
                      x={60} y={74}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      style={{
                        fontFamily: 'Space Mono, monospace',
                        fontSize: 11,
                        fill: 'rgba(255,255,255,0.35)',
                      }}
                    >
                      / {weekGoal}
                    </text>
                  </svg>
                  <span style={{
                    fontSize: 12,
                    fontFamily: 'Space Mono, monospace',
                    color: 'var(--muted)',
                    textAlign: 'center',
                  }}>
                    posts cette semaine
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Responsive styles ── */}
      <style jsx>{`
        @media (max-width: 768px) {
          .section34-wrap {
            flex-direction: column !important;
          }
        }
      `}</style>
    </div>
  )
}
