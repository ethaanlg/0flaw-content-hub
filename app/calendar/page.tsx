'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase, type Post } from '@/lib/supabase'
import PlatformBadge from '@/components/PlatformBadge'
import LoadingSpinner from '@/components/LoadingSpinner'
import {
  format,
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
  eachDayOfInterval,
  isSameDay, isSameMonth,
  addMonths, subMonths,
  addWeeks, subWeeks,
  getHours, getMinutes,
  setHours, setMinutes,
  eachHourOfInterval,
  startOfDay, endOfDay,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'

// ─── helpers ────────────────────────────────────────────────────────────────

const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function isOptimalSlot(date: Date): boolean {
  const day = date.getDay() // 0=Sun, 2=Tue, 4=Thu
  const hour = date.getHours()
  return (day === 2 || day === 4) && hour === 8
}

function isOptimalDay(date: Date): boolean {
  const day = date.getDay()
  return day === 2 || day === 4
}

function statusBg(status: string): string {
  if (status === 'scheduled') return 'rgba(79,111,255,0.2)'
  if (status === 'published') return 'rgba(61,255,160,0.15)'
  if (status === 'failed') return 'rgba(255,79,111,0.15)'
  return 'rgba(255,255,255,0.06)'
}

function statusText(status: string): string {
  if (status === 'scheduled') return '#7a94ff'
  if (status === 'published') return 'var(--green)'
  if (status === 'failed') return 'var(--accent2)'
  return 'rgba(255,255,255,0.45)'
}

function statusLabel(status: string): string {
  if (status === 'scheduled') return 'Programmé'
  if (status === 'published') return 'Publié'
  if (status === 'failed') return 'Échoué'
  return 'Brouillon'
}

// ─── DnD components ─────────────────────────────────────────────────────────

interface DraggablePostProps {
  post: Post
  onSelect: (post: Post) => void
  compact?: boolean
}

function DraggablePost({ post, onSelect, compact }: DraggablePostProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: post.id })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(post)
      }}
      style={{
        opacity: isDragging ? 0.45 : 1,
        cursor: 'grab',
        transform: transform
          ? `translate(${transform.x}px,${transform.y}px)`
          : undefined,
        fontSize: compact ? 10 : 10,
        padding: compact ? '3px 7px' : '4px 8px',
        borderRadius: 6,
        marginBottom: compact ? 3 : 0,
        background: statusBg(post.status),
        color: statusText(post.status),
        border: `1px solid ${statusText(post.status)}44`,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        letterSpacing: '0.02em',
        userSelect: 'none',
        position: compact ? 'relative' : 'absolute',
        left: compact ? undefined : '4px',
        right: compact ? undefined : '4px',
        height: compact ? undefined : 52,
        lineHeight: compact ? undefined : '1.3',
        zIndex: isDragging ? 999 : 1,
        boxSizing: 'border-box',
      }}
    >
      {post.title.length > 22 ? post.title.slice(0, 22) + '…' : post.title}
    </div>
  )
}

interface DroppableDayProps {
  date: Date
  children: React.ReactNode
  isOptimal: boolean
  onClick?: () => void
  style?: React.CSSProperties
}

function DroppableDay({ date, children, isOptimal, onClick, style }: DroppableDayProps) {
  const { isOver, setNodeRef } = useDroppable({ id: date.toISOString() })

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      style={{
        background: isOver
          ? 'rgba(79,111,255,0.08)'
          : isOptimal
          ? 'rgba(61,255,160,0.04)'
          : undefined,
        transition: 'background 0.15s',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [view, setView] = useState<'week' | 'month'>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [posts, setPosts] = useState<Post[]>([])
  const [selected, setSelected] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [descExpanded, setDescExpanded] = useState(false)
  const [publishing, setPublishing] = useState(false)

  // ── date ranges ────────────────────────────────────────────────────────────

  const rangeStart =
    view === 'month'
      ? startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
      : startOfWeek(currentDate, { weekStartsOn: 1 })

  const rangeEnd =
    view === 'month'
      ? endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
      : endOfWeek(currentDate, { weekStartsOn: 1 })

  const weekDays =
    view === 'week'
      ? eachDayOfInterval({ start: rangeStart, end: rangeEnd })
      : []

  const monthDays =
    view === 'month'
      ? eachDayOfInterval({ start: rangeStart, end: rangeEnd })
      : []

  // ── load ──────────────────────────────────────────────────────────────────

  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/posts?from=${rangeStart.toISOString()}&to=${rangeEnd.toISOString()}`
      )
      const json = await res.json()
      setPosts(json.posts ?? [])
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart.toISOString(), rangeEnd.toISOString()])

  useEffect(() => {
    loadPosts()
  }, [loadPosts])

  // ── navigation ────────────────────────────────────────────────────────────

  function goNext() {
    setCurrentDate(d => view === 'month' ? addMonths(d, 1) : addWeeks(d, 1))
  }
  function goPrev() {
    setCurrentDate(d => view === 'month' ? subMonths(d, 1) : subWeeks(d, 1))
  }

  const navLabel =
    view === 'month'
      ? format(currentDate, 'MMMM yyyy', { locale: fr })
      : `${format(rangeStart, 'd MMM', { locale: fr })} – ${format(rangeEnd, 'd MMM yyyy', { locale: fr })}`

  // ── DnD ───────────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const postId = active.id as string
    const newDate = new Date(over.id as string)
    const post = posts.find(p => p.id === postId)
    if (!post || !post.scheduled_at) return

    const oldDate = new Date(post.scheduled_at)
    newDate.setHours(oldDate.getHours(), oldDate.getMinutes(), 0, 0)

    await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: postId, scheduledAt: newDate.toISOString() }),
    })

    setPosts(prev =>
      prev.map(p =>
        p.id === postId ? { ...p, scheduled_at: newDate.toISOString() } : p
      )
    )

    if (selected?.id === postId) {
      setSelected(prev => prev ? { ...prev, scheduled_at: newDate.toISOString() } : null)
    }
  }

  // ── actions ───────────────────────────────────────────────────────────────

  async function handlePublishNow(id: string) {
    setPublishing(true)
    try {
      await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: id }),
      })
      const { data } = await supabase.from('posts').select('*').eq('id', id).single()
      if (data) {
        setPosts(prev => prev.map(p => (p.id === id ? data : p)))
        setSelected(data)
      }
    } finally {
      setPublishing(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Supprimer définitivement ce post ?')) return
    await supabase.from('posts').delete().eq('id', id)
    setPosts(prev => prev.filter(p => p.id !== id))
    setSelected(null)
  }

  // ── render helpers ────────────────────────────────────────────────────────

  function postsForDay(day: Date) {
    return posts.filter(
      p => (p.scheduled_at || p.published_at) &&
        isSameDay(new Date(p.scheduled_at ?? p.published_at!), day)
    )
  }

  function postsForHour(day: Date, hour: number) {
    return posts.filter(p => {
      if (!p.scheduled_at) return false
      const d = new Date(p.scheduled_at)
      return isSameDay(d, day) && getHours(d) === hour
    })
  }

  // ── month view ────────────────────────────────────────────────────────────

  function MonthView() {
    return (
      <div>
        {/* Day headers */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 2,
            marginBottom: 4,
          }}
        >
          {DAYS_SHORT.map(d => (
            <div
              key={d}
              style={{
                textAlign: 'center',
                fontSize: 11,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.3)',
                padding: '8px 0',
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 2,
          }}
        >
          {monthDays.map(day => {
            const dayPosts = postsForDay(day)
            const inMonth = isSameMonth(day, currentDate)
            const isToday = isSameDay(day, new Date())
            const optimal = isOptimalDay(day)
            const visible = dayPosts.slice(0, 3)
            const extra = dayPosts.length - 3

            return (
              <DroppableDay
                key={day.toISOString()}
                date={day}
                isOptimal={optimal}
                onClick={() => {
                  if (dayPosts.length === 0) {
                    window.location.href = '/create'
                  }
                }}
                style={{
                  minHeight: 90,
                  background: isToday ? 'rgba(79,111,255,0.06)' : undefined,
                  border: isToday
                    ? '1px solid rgba(79,111,255,0.3)'
                    : '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 10,
                  padding: '8px',
                  opacity: inMonth ? 1 : 0.3,
                  position: 'relative',
                  cursor: dayPosts.length === 0 ? 'pointer' : 'default',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    marginBottom: 5,
                    color: isToday ? '#7a94ff' : 'rgba(255,255,255,0.4)',
                    fontFamily: 'Syne, sans-serif',
                  }}
                >
                  {format(day, 'd')}
                </div>

                {visible.map(p => (
                  <DraggablePost
                    key={p.id}
                    post={p}
                    onSelect={setSelected}
                    compact
                  />
                ))}

                {extra > 0 && (
                  <div
                    style={{
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.35)',
                      marginTop: 2,
                    }}
                  >
                    +{extra} autre{extra > 1 ? 's' : ''}
                  </div>
                )}

                {optimal && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 5,
                      right: 6,
                      fontSize: 9,
                      color: 'var(--green)',
                      opacity: 0.8,
                    }}
                  >
                    ★ optimal
                  </div>
                )}
              </DroppableDay>
            )
          })}
        </div>
      </div>
    )
  }

  // ── week view ─────────────────────────────────────────────────────────────

  function WeekView() {
    return (
      <div
        style={{
          overflowY: 'auto',
          maxHeight: 600,
          borderRadius: 12,
          border: '1px solid var(--border)',
        }}
      >
        {/* Header row — day names */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '48px repeat(7, 1fr)',
            position: 'sticky',
            top: 0,
            background: 'var(--bg2)',
            zIndex: 10,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div />
          {weekDays.map(d => (
            <div
              key={d.toISOString()}
              style={{
                textAlign: 'center',
                padding: '10px 4px',
                fontSize: 12,
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                color: isSameDay(d, new Date())
                  ? '#7a94ff'
                  : 'rgba(255,255,255,0.45)',
                borderLeft: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6 }}>
                {format(d, 'EEE', { locale: fr })}
              </div>
              <div>{format(d, 'd')}</div>
            </div>
          ))}
        </div>

        {/* Hour rows */}
        {HOURS.map(hour => {
          return (
            <div
              key={hour}
              style={{
                display: 'grid',
                gridTemplateColumns: '48px repeat(7, 1fr)',
                height: 60,
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              {/* Hour label */}
              <div
                style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.25)',
                  padding: '4px 6px',
                  textAlign: 'right',
                  lineHeight: 1,
                  paddingTop: 6,
                }}
              >
                {String(hour).padStart(2, '0')}h
              </div>

              {/* Day cells */}
              {weekDays.map(day => {
                const cellPosts = postsForHour(day, hour)
                const slotDate = new Date(day)
                slotDate.setHours(hour, 0, 0, 0)
                const optimal = isOptimalSlot(slotDate)

                return (
                  <DroppableDay
                    key={day.toISOString()}
                    date={startOfDay(day)}
                    isOptimal={false}
                    style={{
                      position: 'relative',
                      height: 60,
                      background: optimal
                        ? 'rgba(61,255,160,0.04)'
                        : isSameDay(day, new Date())
                        ? 'rgba(79,111,255,0.03)'
                        : undefined,
                      borderLeft: '1px solid rgba(255,255,255,0.04)',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                    }}
                  >
                    {cellPosts.map((p, idx) => (
                      <DraggablePost
                        key={p.id}
                        post={p}
                        onSelect={setSelected}
                        compact={false}
                      />
                    ))}
                    {optimal && cellPosts.length === 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 3,
                          right: 5,
                          fontSize: 9,
                          color: 'var(--green)',
                          opacity: 0.55,
                          pointerEvents: 'none',
                        }}
                      >
                        ★ optimal
                      </div>
                    )}
                  </DroppableDay>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  // ── detail sidebar ────────────────────────────────────────────────────────

  function DetailPanel() {
    if (!selected) return null
    const dateStr = selected.scheduled_at ?? selected.published_at
    const desc = selected.description ?? ''
    const TRUNC = 160

    return (
      <div
        className="card"
        style={{
          alignSelf: 'start',
          position: 'sticky',
          top: 80,
          width: 280,
          flexShrink: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 12,
          }}
        >
          <span className={`tag tag-${selected.status}`}>
            {statusLabel(selected.status)}
          </span>
          <button
            onClick={() => setSelected(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.3)',
              fontSize: 20,
              cursor: 'pointer',
              lineHeight: 1,
              padding: '0 2px',
            }}
          >
            ×
          </button>
        </div>

        <h3
          style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 800,
            fontSize: 15,
            marginBottom: 10,
            lineHeight: 1.3,
          }}
        >
          {selected.title}
        </h3>

        {/* Date */}
        {dateStr && (
          <p
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.4)',
              marginBottom: 12,
            }}
          >
            {format(new Date(dateStr), "EEEE d MMMM · HH'h'mm", { locale: fr })}
          </p>
        )}

        {/* Platforms */}
        {selected.platforms.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              marginBottom: 14,
            }}
          >
            {selected.platforms.map(p => (
              <PlatformBadge
                key={p}
                platform={p as 'linkedin' | 'instagram'}
                size="sm"
              />
            ))}
          </div>
        )}

        {/* Description */}
        {desc && (
          <div style={{ marginBottom: 16 }}>
            <p
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.45)',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}
            >
              {descExpanded ? desc : desc.slice(0, TRUNC)}
              {!descExpanded && desc.length > TRUNC ? '…' : ''}
            </p>
            {desc.length > TRUNC && (
              <button
                onClick={() => setDescExpanded(v => !v)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(79,111,255,0.8)',
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: '4px 0 0',
                }}
              >
                {descExpanded ? 'Réduire' : 'Lire plus'}
              </button>
            )}
          </div>
        )}

        {/* Stats if published */}
        {selected.status === 'published' && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginBottom: 16,
              flexWrap: 'wrap',
            }}
          >
            {selected.linkedin_post_id && (
              <span
                style={{
                  fontSize: 11,
                  padding: '3px 8px',
                  borderRadius: 100,
                  background: 'rgba(79,111,255,0.12)',
                  color: '#7a94ff',
                }}
              >
                LinkedIn
              </span>
            )}
            {selected.instagram_post_id && (
              <span
                style={{
                  fontSize: 11,
                  padding: '3px 8px',
                  borderRadius: 100,
                  background: 'rgba(255,79,111,0.12)',
                  color: 'var(--accent2)',
                }}
              >
                Instagram
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {selected.status === 'scheduled' && (
            <button
              className="btn btn-primary"
              style={{ justifyContent: 'center' }}
              disabled={publishing}
              onClick={() => handlePublishNow(selected.id)}
            >
              {publishing ? 'Publication…' : 'Publier maintenant'}
            </button>
          )}
          <button
            className="btn btn-danger"
            style={{ justifyContent: 'center' }}
            onClick={() => handleDelete(selected.id)}
          >
            Supprimer
          </button>
        </div>
      </div>
    )
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Mobile overlay */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            display: 'none',
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 40,
          }}
          className="mobile-overlay"
        />
      )}

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 32,
          }}
        >
          <h1
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 800,
              fontSize: 32,
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Calendrier
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* View toggle */}
            <div
              style={{
                display: 'flex',
                background: 'var(--bg3)',
                borderRadius: 8,
                padding: 3,
                gap: 2,
              }}
            >
              {(['week', 'month'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    padding: '5px 14px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    background: view === v ? 'var(--accent)' : 'transparent',
                    color: view === v ? '#fff' : 'rgba(255,255,255,0.45)',
                    transition: 'all 0.15s',
                  }}
                >
                  {v === 'week' ? 'Semaine' : 'Mois'}
                </button>
              ))}
            </div>

            {/* Nav */}
            <button className="btn btn-ghost" onClick={goPrev} style={{ padding: '6px 12px' }}>
              ←
            </button>
            <span
              style={{
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: 15,
                minWidth: 180,
                textAlign: 'center',
                textTransform: 'capitalize',
              }}
            >
              {navLabel}
            </span>
            <button className="btn btn-ghost" onClick={goNext} style={{ padding: '6px 12px' }}>
              →
            </button>

            {/* New post */}
            <Link href="/create" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              + Nouveau
            </Link>
          </div>
        </div>

        {/* Main layout */}
        <div
          style={{
            display: 'flex',
            gap: 24,
            alignItems: 'flex-start',
          }}
        >
          {/* Calendar */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {loading ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: 300,
                }}
              >
                <LoadingSpinner />
              </div>
            ) : (
              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                {view === 'month' ? <MonthView /> : <WeekView />}
              </DndContext>
            )}
          </div>

          {/* Detail sidebar */}
          {selected && (
            <div
              className="detail-sidebar"
              style={{ flexShrink: 0 }}
            >
              <DetailPanel />
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .mobile-overlay {
            display: block !important;
          }
          .detail-sidebar {
            position: fixed !important;
            right: 0;
            top: 0;
            bottom: 0;
            z-index: 50;
            overflow-y: auto;
            width: 300px !important;
            padding: 24px 16px;
            background: var(--bg2);
            border-left: 1px solid var(--border);
          }
        }
      `}</style>
    </>
  )
}
