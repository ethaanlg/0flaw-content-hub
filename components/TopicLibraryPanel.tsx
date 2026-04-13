'use client'

import { useEffect, useState, useCallback } from 'react'
import type { CuratedTopic, UserTopic } from '@/lib/types'

type Category = 'menaces' | 'conformite' | 'sensibilisation' | 'custom'

const CATEGORY_LABELS: Record<string, string> = {
  menaces: 'Menaces',
  conformite: 'Conformité',
  sensibilisation: 'Sensib.',
  custom: 'Mes topics',
}

type Props = {
  onSelect: (title: string, description: string) => void
  onClose: () => void
}

export default function TopicLibraryPanel({ onSelect, onClose }: Props) {
  const [curated, setCurated] = useState<CuratedTopic[]>([])
  const [userTopics, setUserTopics] = useState<UserTopic[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('menaces')
  const [loading, setLoading] = useState(true)
  const [addTitle, setAddTitle] = useState('')
  const [addDesc, setAddDesc] = useState('')
  const [adding, setAdding] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchTopics = useCallback(async () => {
    try {
      const res = await fetch('/api/topics')
      if (!res.ok) throw new Error('Fetch failed')
      const data = await res.json()
      setCurated(data.curated ?? [])
      setUserTopics(data.user ?? [])
    } catch {
      // On error, keep empty lists — curated topics are shown as-is from state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTopics() }, [fetchTopics])

  async function handleAdd() {
    if (!addTitle.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: addTitle.trim(), description: addDesc.trim() || undefined, category: 'custom' }),
      })
      if (!res.ok) throw new Error('Création échouée')
      const newTopic: UserTopic = await res.json()
      setUserTopics(prev => [newTopic, ...prev])
      setAddTitle('')
      setAddDesc('')
      setShowAddForm(false)
    } catch {
      // silently ignore — user can retry
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    if (deletingId === id) {
      // Second click — confirm delete
      try {
        await fetch(`/api/topics?id=${id}`, { method: 'DELETE' })
        setUserTopics(prev => prev.filter(t => t.id !== id))
      } finally {
        setDeletingId(null)
      }
    } else {
      setDeletingId(id)
      setTimeout(() => setDeletingId(null), 2000)
    }
  }

  const filteredCurated = curated.filter(t => t.category === activeCategory)

  const categories = ['menaces', 'conformite', 'sensibilisation', 'custom']

  return (
    <div style={{
      width: 240,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>📚 Bibliothèque</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', fontSize: 11, color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 0 }}
        >✕</button>
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: '3px 8px',
              borderRadius: 100,
              background: activeCategory === cat ? 'rgba(79,111,255,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${activeCategory === cat ? 'rgba(79,111,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
              fontSize: 10,
              fontWeight: 700,
              color: activeCategory === cat ? '#7a94ff' : 'rgba(255,255,255,0.35)',
              cursor: 'pointer',
            }}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* Topics list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 0' }}>
        {loading ? (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', padding: '12px 6px' }}>Chargement…</div>
        ) : (
          <>
            {/* Curated topics for active category */}
            {filteredCurated.length > 0 && (
              <>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.2)', letterSpacing: '.1em', textTransform: 'uppercase', padding: '4px 6px 6px' }}>
                  {CATEGORY_LABELS[activeCategory]}
                </div>
                {filteredCurated.map(topic => (
                  <button
                    key={topic.id}
                    onClick={() => { onSelect(topic.title, topic.description); onClose() }}
                    style={{
                      width: '100%',
                      padding: '9px 10px',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      marginBottom: 4,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{topic.title}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{topic.description}</div>
                  </button>
                ))}
              </>
            )}

            {/* User topics (shown on "custom" tab) */}
            {(activeCategory === 'custom') && (
              <>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.2)', letterSpacing: '.1em', textTransform: 'uppercase', padding: '4px 6px 6px' }}>
                  Mes topics
                </div>
                {userTopics.map(topic => (
                  <div
                    key={topic.id}
                    style={{
                      padding: '9px 10px',
                      borderRadius: 8,
                      background: 'rgba(61,255,160,0.06)',
                      border: '1px solid rgba(61,255,160,0.15)',
                      marginBottom: 4,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <button
                      onClick={() => { onSelect(topic.title, topic.description ?? ''); onClose() }}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', flex: 1, minWidth: 0 }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{topic.title}</div>
                      {topic.description && (
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{topic.description}</div>
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(topic.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: 10,
                        color: deletingId === topic.id ? '#ff4f6f' : 'rgba(255,255,255,0.2)',
                        cursor: 'pointer',
                        flexShrink: 0,
                        marginLeft: 8,
                        padding: 0,
                      }}
                    >✕</button>
                  </div>
                ))}

                {/* Add form */}
                {showAddForm ? (
                  <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                    <input
                      placeholder="Titre du topic"
                      value={addTitle}
                      onChange={e => setAddTitle(e.target.value)}
                      style={{
                        padding: '7px 10px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 7,
                        color: '#fff',
                        fontSize: 11,
                        outline: 'none',
                      }}
                    />
                    <input
                      placeholder="Description (optionnel)"
                      value={addDesc}
                      onChange={e => setAddDesc(e.target.value)}
                      style={{
                        padding: '7px 10px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 7,
                        color: '#fff',
                        fontSize: 11,
                        outline: 'none',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => { setShowAddForm(false); setAddTitle(''); setAddDesc('') }}
                        style={{ flex: 1, padding: '6px 0', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 10, color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
                      >Annuler</button>
                      <button
                        onClick={handleAdd}
                        disabled={adding || !addTitle.trim()}
                        style={{ flex: 2, padding: '6px 0', borderRadius: 7, background: 'rgba(79,111,255,0.8)', border: 'none', fontSize: 10, fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: adding || !addTitle.trim() ? 0.5 : 1 }}
                      >{adding ? '…' : 'Ajouter'}</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddForm(true)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: '1px dashed rgba(255,255,255,0.1)',
                      background: 'none',
                      textAlign: 'center',
                      cursor: 'pointer',
                      marginBottom: 8,
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.3)',
                    }}
                  >+ Ajouter</button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
