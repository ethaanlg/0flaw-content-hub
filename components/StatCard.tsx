'use client'

import React, { useEffect, useRef, useState } from 'react'

type StatCardProps = {
  icon: React.ReactNode
  label: string
  value: number | string
  unit?: string
  trend?: number
  color?: string
  loading?: boolean
}

export default function StatCard({
  icon,
  label,
  value,
  unit,
  trend,
  color = 'var(--accent)',
  loading = false,
}: StatCardProps) {
  const [displayValue, setDisplayValue] = useState<number | string>(
    typeof value === 'number' ? 0 : value
  )
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (loading) return
    if (typeof value !== 'number') {
      setDisplayValue(value)
      return
    }

    const duration = 1200
    const start = performance.now()
    const from = 0
    const to = value

    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(from + (to - from) * eased)
      setDisplayValue(current)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setDisplayValue(to)
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [value, loading])

  const trendBadge = () => {
    if (trend === undefined || trend === null) return null
    if (trend > 0) {
      return (
        <span style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: '999px',
          fontSize: '11px',
          fontFamily: 'Space Mono, monospace',
          background: 'rgba(61,255,160,0.12)',
          color: 'var(--green)',
          fontWeight: 700,
        }}>
          +{trend}%
        </span>
      )
    } else if (trend < 0) {
      return (
        <span style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: '999px',
          fontSize: '11px',
          fontFamily: 'Space Mono, monospace',
          background: 'rgba(255,79,111,0.12)',
          color: 'var(--accent2)',
          fontWeight: 700,
        }}>
          {trend}%
        </span>
      )
    } else {
      return (
        <span style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: '999px',
          fontSize: '11px',
          fontFamily: 'Space Mono, monospace',
          background: 'rgba(255,255,255,0.07)',
          color: 'var(--muted)',
          fontWeight: 700,
        }}>
          stable
        </span>
      )
    }
  }

  if (loading) {
    return (
      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${color}`,
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        minWidth: '160px',
      }}>
        <div className="skeleton" style={{ height: '12px', width: '60%', borderRadius: '6px' }} />
        <div className="skeleton" style={{ height: '32px', width: '80%', borderRadius: '6px' }} />
        <div className="skeleton" style={{ height: '20px', width: '40%', borderRadius: '6px' }} />
      </div>
    )
  }

  return (
    <div
      className="stat-card-root"
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${color}`,
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        position: 'relative',
        cursor: 'default',
        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
        minWidth: '160px',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'translateY(-2px)'
        el.style.boxShadow = '0 8px 32px rgba(79,111,255,0.12)'
        el.style.borderColor = 'var(--accent)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = ''
        el.style.boxShadow = ''
        el.style.borderColor = 'var(--border)'
      }}
    >
      {/* Icon */}
      <div style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        width: '36px',
        height: '36px',
        borderRadius: '8px',
        background: `rgba(79,111,255,0.12)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: color,
        flexShrink: 0,
      }}>
        {icon}
      </div>

      {/* Label */}
      <span style={{
        fontSize: '11px',
        fontFamily: 'Space Mono, monospace',
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
        color: 'var(--muted)',
        lineHeight: 1,
      }}>
        {label}
      </span>

      {/* Value + Unit */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <span style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 800,
          fontSize: '32px',
          color: color,
          lineHeight: 1,
        }}>
          {displayValue}
        </span>
        {unit && (
          <span style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: '14px',
            color: 'var(--muted)',
          }}>
            {unit}
          </span>
        )}
      </div>

      {/* Trend */}
      {trend !== undefined && trend !== null && (
        <div>{trendBadge()}</div>
      )}
    </div>
  )
}
