'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Post } from '@/lib/types'
import PlatformBadge from '@/components/PlatformBadge'
import EmptyState from '@/components/EmptyState'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'draft' | 'scheduled' | 'published' | 'failed'
type PlatformFilter = 'all' | 'linkedin' | 'instagram'
type SortKey = 'created_at' | 'scheduled_at' | 'published_at'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(s: string) {
  if (s === 'draft') return 'Brouillon'
  if (s === 'scheduled') return 'Programmé'
  if (s === 'published') return 'Publié'
  if (s === 'failed') return 'Échoué'
  return s
}

function dateFor(p: Post, sort: SortKey): string | null {
  if (sort === 'published_at') return p.published_at
  if (sort === 'scheduled_at') return p.scheduled_at
  return p.created_at
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [platform, setPlatform] = useState<PlatformFilter>('all')
  const [sort, setSort] = useState<SortKey>('created_at')
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
      setPosts(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleDelete(id: string) {
    if (!window.confirm('Supprimer définitivement ce post ?')) return
    setDeleting(id)
    await supabase.from('posts').delete().eq('id', id)
    setPosts(prev => prev.filter(p => p.id !== id))
    setDeleting(null)
  }

  const filtered = useMemo(() => {
    let list = posts

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(p =>
        p.title.toLowerCase().includes(q) ||
        (p.topic ?? '').toLowerCase().includes(q)
      )
    }

    if (status !== 'all') list = list.filter(p => p.status === status)

    if (platform !== 'all') list = list.filter(p => p.platforms.includes(platform))

    list = [...list].sort((a, b) => {
      const da = dateFor(a, sort) ?? a.created_at
      const db = dateFor(b, sort) ?? b.created_at
      return new Date(db).getTime() - new Date(da).getTime()
    })

    return list
  }, [posts, search, status, platform, sort])

  const counts: Record<StatusFilter, number> = useMemo(() => ({
    all: posts.length,
    draft: posts.filter(p => p.status === 'draft').length,
    scheduled: posts.filter(p => p.status === 'scheduled').length,
    published: posts.filter(p => p.status === 'published').length,
    failed: posts.filter(p => p.status === 'failed').length,
  }), [posts])

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px 64px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', margin: 0 }}>
          Historique
        </h1>
        <Link href="/create" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          + Nouveau post
        </Link>
      </div>

      {/* Filters row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>

        {/* Search */}
        <input
          type="text"
          placeholder="Rechercher un post..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 240, flexShrink: 0 }}
        />

        {/* Status tabs */}
        <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 8, padding: 3, gap: 2 }}>
          {(['all', 'draft', 'scheduled', 'published', 'failed'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'inherit',
                background: status === s ? 'var(--accent)' : 'transparent',
                color: status === s ? '#fff' : 'rgba(255,255,255,0.45)',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {s === 'all' ? 'Tous' : statusLabel(s)}
              <span style={{
                marginLeft: 5,
                fontSize: 10,
                opacity: 0.7,
                fontFamily: 'Space Mono, monospace',
              }}>
                {counts[s]}
              </span>
            </button>
          ))}
        </div>

        {/* Platform filter */}
        <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 8, padding: 3, gap: 2 }}>
          {(['all', 'linkedin', 'instagram'] as PlatformFilter[]).map(p => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'inherit',
                background: platform === p ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: platform === p
                  ? p === 'linkedin' ? '#4da3d4' : p === 'instagram' ? '#e1306c' : '#fff'
                  : 'rgba(255,255,255,0.45)',
                transition: 'all 0.15s',
              }}
            >
              {p === 'all' ? 'Toutes' : p === 'linkedin' ? 'LinkedIn' : 'Instagram'}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          style={{ width: 'auto', flexShrink: 0 }}
        >
          <option value="created_at">Créé le</option>
          <option value="scheduled_at">Programmé le</option>
          <option value="published_at">Publié le</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 64, borderRadius: 12 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 0 }}>
          <EmptyState
            icon="post"
            title="Aucun post trouvé"
            subtitle={search || status !== 'all' || platform !== 'all'
              ? 'Essaie de modifier les filtres'
              : 'Crée ton premier contenu'}
            cta={search || status !== 'all' || platform !== 'all'
              ? undefined
              : { label: 'Créer un post', href: '/create' }}
          />
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Titre', 'Statut', 'Plateformes', 'Date', ''].map((h, i) => (
                  <th key={i} style={{
                    padding: '14px 16px',
                    textAlign: 'left',
                    fontSize: 11,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.3)',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, idx) => {
                const d = dateFor(p, sort) ?? p.created_at
                const dateLabel = d ? format(new Date(d), "d MMM yyyy · HH'h'mm", { locale: fr }) : '—'

                return (
                  <tr
                    key={p.id}
                    style={{
                      borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Title */}
                    <td style={{ padding: '14px 16px', maxWidth: 280 }}>
                      <div style={{
                        fontFamily: 'Syne, sans-serif',
                        fontWeight: 700,
                        fontSize: 13,
                        color: '#fff',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {p.title}
                      </div>
                      {p.topic && (
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>
                          {p.topic}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <span className={`tag tag-${p.status}`}>{statusLabel(p.status)}</span>
                    </td>

                    {/* Platforms */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {p.platforms.map(pl => (
                          <PlatformBadge key={pl} platform={pl as 'linkedin' | 'instagram'} size="sm" />
                        ))}
                      </div>
                    </td>

                    {/* Date */}
                    <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.35)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {dateLabel}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        {p.pdf_url && (
                          <a
                            href={p.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost"
                            style={{ fontSize: 11, padding: '5px 12px' }}
                          >
                            PDF
                          </a>
                        )}
                        <button
                          className="btn btn-danger"
                          style={{ fontSize: 11, padding: '5px 12px' }}
                          disabled={deleting === p.id}
                          onClick={() => handleDelete(p.id)}
                        >
                          {deleting === p.id ? '...' : 'Supprimer'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Count */}
      {!loading && filtered.length > 0 && (
        <p style={{ marginTop: 16, fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'right' }}>
          {filtered.length} post{filtered.length > 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
