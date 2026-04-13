'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: '+ Créer' },
  { href: '/calendar', label: 'Calendrier' },
  { href: '/analytics', label: 'Analytics' },
]

export default function Nav() {
  const path = usePathname()
  return (
    <nav style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px', height: '60px',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      background: 'rgba(15,18,37,0.95)',
      backdropFilter: 'blur(12px)',
      position: 'sticky', top: 0, zIndex: 100
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: 'linear-gradient(135deg, #4f6fff, #ff4f6f)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, fontFamily: 'Syne, sans-serif'
        }}>0F</div>
        <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em' }}>
          Content Hub
        </span>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {links.map(l => (
          <Link key={l.href} href={l.href} style={{
            padding: '7px 18px',
            borderRadius: 100,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            background: path === l.href ? 'rgba(79,111,255,0.18)' : 'transparent',
            color: path === l.href ? '#7a94ff' : 'rgba(255,255,255,0.45)',
            border: path === l.href ? '1px solid rgba(79,111,255,0.3)' : '1px solid transparent',
            transition: 'all 0.15s'
          }}>{l.label}</Link>
        ))}
      </div>
    </nav>
  )
}
