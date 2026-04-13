'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Post, PostStats } from '@/lib/types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts'
import { format, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'

type PostWithStats = Post & { stats: PostStats[] }

const METRICS = [
  { key: 'impressions', label: 'Impressions', color: '#4f6fff' },
  { key: 'reach', label: 'Reach', color: '#7a94ff' },
  { key: 'likes', label: 'Likes', color: '#ff4f6f' },
  { key: 'engagement_rate', label: 'Eng. Rate %', color: '#3dffa0' },
]

function StatCard({ label, value, sub, color }: { label: string, value: string, sub?: string, color?: string }) {
  return (
    <div className="card" style={{ flex: 1 }}>
      <div style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 36, letterSpacing: '-0.03em', color: color || 'var(--white)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1a1f36', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px' }}>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ fontSize: 13, color: p.color, fontWeight: 700 }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [posts, setPosts] = useState<PostWithStats[]>([])
  const [platform, setPlatform] = useState<'linkedin' | 'instagram'>('linkedin')
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: postsData } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(30)

    if (!postsData) { setLoading(false); return }

    const { data: statsData } = await supabase
      .from('post_stats')
      .select('*')
      .in('post_id', postsData.map(p => p.id))
      .order('collected_at', { ascending: false })

    const withStats = postsData.map(p => ({
      ...p,
      stats: (statsData || []).filter(s => s.post_id === p.id)
    }))
    setPosts(withStats)
    setLoading(false)
  }

  async function collectStats(postId: string) {
    setCollecting(postId)
    await fetch('/api/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId })
    })
    await loadData()
    setCollecting(null)
  }

  // Calculs agrégés
  const platformPosts = posts.filter(p => p.platforms.includes(platform))
  const latestStats = (p: PostWithStats) => p.stats.filter(s => s.platform === platform).sort(
    (a, b) => new Date(b.collected_at).getTime() - new Date(a.collected_at).getTime()
  )[0]

  const totalImpressions = platformPosts.reduce((sum, p) => sum + (latestStats(p)?.impressions || 0), 0)
  const totalEngagements = platformPosts.reduce((sum, p) => {
    const s = latestStats(p)
    return sum + (s ? s.likes + s.comments + s.shares : 0)
  }, 0)
  const avgEngRate = platformPosts.length
    ? (platformPosts.reduce((sum, p) => sum + (latestStats(p)?.engagement_rate || 0), 0) / platformPosts.length).toFixed(2)
    : '0'
  const bestPost = platformPosts.reduce((best, p) => {
    const e = latestStats(p)?.engagement_rate || 0
    return e > (latestStats(best)?.engagement_rate || 0) ? p : best
  }, platformPosts[0])

  // Données graphique évolution
  const chartData = platformPosts.slice(0, 12).reverse().map(p => {
    const s = latestStats(p)
    return {
      name: p.title.slice(0, 20) + '...',
      Impressions: s?.impressions || 0,
      Reach: s?.reach || 0,
      'Eng. Rate': s?.engagement_rate || 0,
    }
  })

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
      Chargement...
    </div>
  )

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em' }}>Analytics</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['linkedin', 'instagram'] as const).map(p => (
            <button key={p} className="btn" onClick={() => setPlatform(p)} style={{
              background: platform === p ? (p === 'linkedin' ? 'rgba(0,119,181,0.2)' : 'rgba(225,48,108,0.2)') : 'rgba(255,255,255,0.05)',
              color: platform === p ? (p === 'linkedin' ? '#4da3d4' : '#e1306c') : 'rgba(255,255,255,0.35)',
              border: platform === p ? `1px solid ${p === 'linkedin' ? 'rgba(0,119,181,0.4)' : 'rgba(225,48,108,0.4)'}` : '1px solid transparent',
            }}>{p === 'linkedin' ? 'LinkedIn' : 'Instagram'}</button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
        <StatCard label="Impressions totales" value={totalImpressions.toLocaleString('fr')} sub={`${platformPosts.length} posts publiés`} color="#4f6fff" />
        <StatCard label="Engagements" value={totalEngagements.toLocaleString('fr')} sub="likes + comments + shares" color="#ff4f6f" />
        <StatCard label="Eng. rate moyen" value={`${avgEngRate}%`} sub={platform === 'linkedin' ? 'Objectif : > 3%' : 'Objectif : > 5%'} color="#3dffa0" />
        <StatCard label="Meilleur post" value={bestPost ? `${latestStats(bestPost)?.engagement_rate || 0}%` : '—'} sub={bestPost?.title?.slice(0, 25) + '...'} />
      </div>

      {/* Evolution chart */}
      {chartData.length > 0 && (
        <div className="card" style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>
            Évolution — 12 derniers posts
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }} />
              <Line type="monotone" dataKey="Impressions" stroke="#4f6fff" strokeWidth={2} dot={{ fill: '#4f6fff', r: 3 }} />
              <Line type="monotone" dataKey="Reach" stroke="#7a94ff" strokeWidth={2} dot={{ fill: '#7a94ff', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Posts table */}
      <div className="card">
        <div style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>
          Tous les posts publiés
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Post', 'Date', 'Imp.', 'Reach', 'Likes', 'Eng.%', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {platformPosts.map(p => {
                const s = latestStats(p)
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 12px', maxWidth: 220 }}>
                      <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                    </td>
                    <td style={{ padding: '12px 12px', color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {p.published_at ? format(new Date(p.published_at), 'd MMM', { locale: fr }) : '—'}
                    </td>
                    <td style={{ padding: '12px 12px', color: '#4f6fff', fontWeight: 700 }}>{s?.impressions?.toLocaleString('fr') || '—'}</td>
                    <td style={{ padding: '12px 12px', color: 'rgba(255,255,255,0.5)' }}>{s?.reach?.toLocaleString('fr') || '—'}</td>
                    <td style={{ padding: '12px 12px', color: '#ff4f6f' }}>{s?.likes || '—'}</td>
                    <td style={{ padding: '12px 12px' }}>
                      {s ? (
                        <span style={{
                          color: s.engagement_rate >= 3 ? 'var(--green)' : s.engagement_rate >= 1 ? '#ffaa4f' : 'rgba(255,255,255,0.35)',
                          fontWeight: 700
                        }}>{s.engagement_rate}%</span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <button
                        className="btn btn-ghost"
                        onClick={() => collectStats(p.id)}
                        disabled={collecting === p.id}
                        style={{ fontSize: 11, padding: '5px 12px' }}
                      >
                        {collecting === p.id ? '...' : '↻ Stats'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {platformPosts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>
              Aucun post publié sur {platform} pour l'instant.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
