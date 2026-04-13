'use client'

import React from 'react'
import PlatformBadge from '@/components/PlatformBadge'

type Post = {
  id: string
  title: string
  topic: string | null
  description: string | null
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  platforms: string[]
  scheduled_at: string | null
  published_at: string | null
  linkedin_post_id: string | null
  instagram_post_id: string | null
  pdf_url: string | null
  slides_urls: string[] | null
  created_at: string
  updated_at: string
}

type PostCardProps = {
  post: Post
  onClick?: () => void
  showStats?: boolean
  reach?: number
  engagementRate?: number
  compact?: boolean
}

const STATUS_HOVER_COLOR: Record<Post['status'], string> = {
  scheduled: 'var(--accent)',
  published: 'var(--green)',
  failed: 'var(--accent2)',
  draft: 'var(--muted)',
}

function formatDate(post: Post): string | null {
  if (post.scheduled_at) {
    const d = new Date(post.scheduled_at)
    const day = d.getDate()
    const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc']
    const month = months[d.getMonth()]
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${day} ${month} · ${hours}h${minutes}`
  }
  if (post.published_at) {
    const d = new Date(post.published_at)
    const day = d.getDate()
    const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc']
    const month = months[d.getMonth()]
    return `Publié le ${day} ${month}`
  }
  return null
}

function formatReach(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export default function PostCard({
  post,
  onClick,
  showStats = false,
  reach,
  engagementRate,
  compact = false,
}: PostCardProps) {
  const hoverBorderColor = STATUS_HOVER_COLOR[post.status]
  const dateStr = formatDate(post)

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    el.style.borderColor = hoverBorderColor
    el.style.transform = 'translateY(-2px)'
  }

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    el.style.borderColor = 'var(--border)'
    el.style.transform = ''
  }

  return (
    <div
      className="card card-hover"
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        padding: compact ? '12px 14px' : '18px 20px',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? '6px' : '10px',
        borderColor: 'var(--border)',
        transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Row 1: platform badges + status tag */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {post.platforms.map((platform) => (
            <PlatformBadge key={platform} platform={platform as 'linkedin' | 'instagram'} />
          ))}
        </div>
        <span className={`tag tag-${post.status}`} style={{ flexShrink: 0 }}>
          {post.status}
        </span>
      </div>

      {/* Row 2: title */}
      <div style={{
        fontFamily: 'Syne, sans-serif',
        fontWeight: 700,
        fontSize: compact ? '13px' : '15px',
        color: '#fff',
        lineHeight: '1.4',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {post.title}
      </div>

      {/* Row 3: date */}
      {dateStr && (
        <div style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: '12px',
          color: 'var(--muted)',
          lineHeight: 1,
        }}>
          {dateStr}
        </div>
      )}

      {/* Row 4: stats (only if showStats and not compact) */}
      {showStats && !compact && (
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginTop: '2px',
        }}>
          {reach !== undefined && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '999px',
              fontSize: '11px',
              fontFamily: 'Space Mono, monospace',
              background: 'rgba(79,111,255,0.12)',
              color: 'var(--accent)',
              fontWeight: 700,
            }}>
              {formatReach(reach)} reach
            </span>
          )}
          {engagementRate !== undefined && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '999px',
              fontSize: '11px',
              fontFamily: 'Space Mono, monospace',
              background: 'rgba(61,255,160,0.10)',
              color: 'var(--green)',
              fontWeight: 700,
            }}>
              {engagementRate.toFixed(1)}% eng.
            </span>
          )}
        </div>
      )}
    </div>
  )
}
