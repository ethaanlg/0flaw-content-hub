'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarDays, BarChart2, PlusCircle, Zap, History, Settings, Link2, Inbox } from 'lucide-react'

const nav = [
  { href: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard'  },
  { href: '/create',      icon: PlusCircle,      label: 'Créer'      },
  { href: '/calendar',    icon: CalendarDays,    label: 'Calendrier' },
  { href: '/history',     icon: History,         label: 'Historique' },
  { href: '/analytics',   icon: BarChart2,       label: 'Analytics'  },
  { href: '/inbox',       icon: Inbox,           label: 'Inbox'      },
  { href: '/connections', icon: Link2,           label: 'Connexions' },
  { href: '/settings',    icon: Settings,        label: 'Paramètres' },
]

export default function Sidebar() {
  const path = usePathname()

  return (
    <>
      {/* Full sidebar — visible ≥ 1280px */}
      <aside style={{
        position: 'fixed', left: 0, top: 0,
        height: '100vh', width: 256,
        display: 'flex', flexDirection: 'column',
        background: '#0d1123',
        borderRight: '1px solid var(--border)',
        zIndex: 50,
        transition: 'width 0.25s ease',
      }}
        className="sidebar-full"
      >
        {/* Logo */}
        <div style={{ padding: '24px 20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(79,111,255,0.15)',
              border: '1px solid rgba(79,111,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Zap size={16} color="#4f6fff" />
            </div>
            <div className="sidebar-label">
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 14, color: '#fff', lineHeight: 1 }}>0Flaw</p>
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3, fontFamily: 'Space Mono, monospace' }}>Content Hub</p>
            </div>
          </div>
        </div>

        <div style={{ width: '90%', margin: '0 auto', height: 1, background: 'var(--border)' }} />

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {nav.map(({ href, icon: Icon, label }) => {
            const active = path === href || (href === '/dashboard' && path === '/')
            return (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 10,
                fontSize: 13, fontWeight: 700,
                fontFamily: 'Space Mono, monospace',
                letterSpacing: '0.03em',
                transition: 'all 0.15s',
                background: active ? 'rgba(79,111,255,0.12)' : 'transparent',
                border: active ? '1px solid rgba(79,111,255,0.2)' : '1px solid transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.45)',
              }}>
                <Icon size={15} color={active ? '#4f6fff' : 'currentColor'} style={{ flexShrink: 0 }} />
                <span className="sidebar-label">{label}</span>
                {active && (
                  <span style={{
                    marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%',
                    background: '#4f6fff', boxShadow: '0 0 8px rgba(79,111,255,0.8)',
                  }} />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer — avatar */}
        <div style={{ padding: '12px 10px 20px' }}>
          <div style={{ width: '90%', margin: '0 auto 12px', height: 1, background: 'var(--border)' }} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 10,
            background: 'rgba(79,111,255,0.06)',
            border: '1px solid rgba(79,111,255,0.12)',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #4f6fff, #ff4f6f)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 13, color: '#fff',
            }}>E</div>
            <div className="sidebar-label">
              <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1 }}>Ethan</p>
              <p style={{ fontSize: 10, color: '#4f6fff', marginTop: 3, letterSpacing: '0.05em' }}>Admin · 0Flaw</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Collapsed sidebar — visible 768–1280px */}
      <style>{`
        @media (max-width: 1280px) {
          .sidebar-label { display: none !important; }
          .sidebar-full { width: 60px !important; }
        }
        @media (max-width: 768px) {
          .sidebar-full { display: none !important; }
        }
      `}</style>
    </>
  )
}
