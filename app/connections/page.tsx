'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

// ─── Types ────────────────────────────────────────────────────────────────────

type Platform = 'linkedin' | 'instagram' | 'x' | 'threads'

type PlatformConnection = {
  id: string
  user_id: string
  platform: Platform
  account_name: string | null
  expires_at: string | null
  connected_at: string | null
}

type ConnectionStatus = 'connected' | 'expired' | 'disconnected'

// ─── Platform config ──────────────────────────────────────────────────────────

const PLATFORMS: {
  key: Platform
  name: string
  icon: string
  color: string
}[] = [
  { key: 'linkedin',  name: 'LinkedIn',   icon: '💼', color: 'bg-blue-600'  },
  { key: 'instagram', name: 'Instagram',  icon: '📸', color: 'bg-pink-600'  },
  { key: 'x',         name: 'X (Twitter)', icon: '𝕏', color: 'bg-gray-800'  },
  { key: 'threads',   name: 'Threads',    icon: '🧵', color: 'bg-black'     },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatus(conn: PlatformConnection | undefined): ConnectionStatus {
  if (!conn) return 'disconnected'
  if (conn.expires_at && new Date(conn.expires_at) < new Date()) return 'expired'
  return 'connected'
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), "d MMM yyyy", { locale: fr })
  } catch {
    return '—'
  }
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const styles: Record<ConnectionStatus, { bg: string; color: string; label: string }> = {
    connected:    { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', label: 'Connecté'    },
    expired:      { bg: 'rgba(234,179,8,0.15)',  color: '#eab308', label: 'Expiré'      },
    disconnected: { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)', label: 'Déconnecté' },
  }
  const s = styles[status]
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 999,
      fontSize: 11,
      fontFamily: 'Space Mono, monospace',
      fontWeight: 700,
      background: s.bg,
      color: s.color,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
    }}>
      {s.label}
    </span>
  )
}

// ─── Platform Card ────────────────────────────────────────────────────────────

function PlatformCard({
  platform,
  connection,
  onDisconnect,
  disconnecting,
}: {
  platform: typeof PLATFORMS[number]
  connection: PlatformConnection | undefined
  onDisconnect: (id: string) => void
  disconnecting: string | null
}) {
  const status = getStatus(connection)
  const isConnected = status !== 'disconnected'

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: 20,
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Icon bubble */}
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.10)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          flexShrink: 0,
        }}>
          {platform.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 800,
            fontSize: 16,
            color: '#fff',
            lineHeight: 1.2,
            marginBottom: 4,
          }}>
            {platform.name}
          </p>
          <p style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: 12,
            color: isConnected && connection?.account_name
              ? 'rgba(255,255,255,0.6)'
              : 'rgba(255,255,255,0.3)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {isConnected && connection?.account_name ? connection.account_name : 'Non connecté'}
          </p>
        </div>

        <StatusBadge status={status} />
      </div>

      {/* Dates */}
      <div style={{
        display: 'flex',
        gap: 20,
        flexWrap: 'wrap',
      }}>
        <div>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
            Connecté le
          </p>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
            {formatDate(connection?.connected_at ?? null)}
          </p>
        </div>
        {connection?.expires_at && (
          <div>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
              Expire le
            </p>
            <p style={{
              fontFamily: 'Space Mono, monospace',
              fontSize: 12,
              color: status === 'expired' ? '#eab308' : 'rgba(255,255,255,0.55)',
            }}>
              {formatDate(connection.expires_at)}
            </p>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {/* Connect / Reconnect button */}
        <a
          href={`/api/auth/${platform.key}`}
          style={{
            flex: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '9px 16px',
            borderRadius: 10,
            fontSize: 12,
            fontFamily: 'Space Mono, monospace',
            fontWeight: 700,
            letterSpacing: '0.03em',
            textDecoration: 'none',
            background: status === 'disconnected'
              ? 'rgba(0,229,255,0.12)'
              : 'rgba(255,255,255,0.07)',
            border: status === 'disconnected'
              ? '1px solid rgba(0,229,255,0.3)'
              : '1px solid rgba(255,255,255,0.12)',
            color: status === 'disconnected' ? '#00E5FF' : 'rgba(255,255,255,0.7)',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          {status === 'disconnected' ? 'Connecter' : 'Reconnecter'}
        </a>

        {/* Disconnect button — only when connected or expired */}
        {isConnected && connection && (
          <button
            onClick={() => onDisconnect(connection.id)}
            disabled={disconnecting === connection.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '9px 14px',
              borderRadius: 10,
              fontSize: 12,
              fontFamily: 'Space Mono, monospace',
              fontWeight: 700,
              letterSpacing: '0.03em',
              background: 'rgba(239,68,68,0.10)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: disconnecting === connection.id ? 'rgba(239,68,68,0.4)' : '#ef4444',
              cursor: disconnecting === connection.id ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {disconnecting === connection.id ? '...' : 'Déconnecter'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<PlatformConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const { data, error: fetchError } = await supabase
          .from('platform_connections')
          .select('*')

        if (fetchError) throw fetchError
        setConnections((data as PlatformConnection[]) ?? [])
      } catch (e) {
        console.error('Connections fetch error:', e)
        setError('Impossible de charger les connexions.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleDisconnect(id: string) {
    setDisconnecting(id)
    try {
      const { error: deleteError } = await supabase
        .from('platform_connections')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      setConnections((prev) => prev.filter((c) => c.id !== id))
    } catch (e) {
      console.error('Disconnect error:', e)
      setError('Échec de la déconnexion.')
    } finally {
      setDisconnecting(null)
    }
  }

  const connMap = Object.fromEntries(
    connections.map((c) => [c.platform, c])
  ) as Partial<Record<Platform, PlatformConnection>>

  return (
    <div style={{
      position: 'relative',
      zIndex: 1,
      maxWidth: 900,
      margin: '0 auto',
      padding: '32px 24px 64px',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 800,
          fontSize: 28,
          color: '#fff',
          lineHeight: 1.1,
          marginBottom: 8,
        }}>
          Connexions
        </h1>
        <p style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: 13,
          color: 'rgba(255,255,255,0.4)',
        }}>
          Gérez vos comptes sociaux connectés via OAuth
        </p>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          marginBottom: 24,
          padding: '12px 16px',
          borderRadius: 12,
          background: 'rgba(239,68,68,0.10)',
          border: '1px solid rgba(239,68,68,0.25)',
          fontFamily: 'Space Mono, monospace',
          fontSize: 12,
          color: '#ef4444',
        }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <p style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: 13,
          color: 'rgba(255,255,255,0.4)',
        }}>
          Chargement...
        </p>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 20,
        }}>
          {PLATFORMS.map((platform) => (
            <PlatformCard
              key={platform.key}
              platform={platform}
              connection={connMap[platform.key]}
              onDisconnect={handleDisconnect}
              disconnecting={disconnecting}
            />
          ))}
        </div>
      )}
    </div>
  )
}
