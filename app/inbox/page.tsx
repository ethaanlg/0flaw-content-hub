'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type Proposal = {
  id: string
  proposal_type: string
  platform: string[] | null
  title: string
  content: Record<string, unknown>
  justification: string | null
  optimal_publish_at: string | null
  status: 'pending' | 'approved' | 'edited' | 'rejected'
  suggested_at: string
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InboxPage() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('agent_proposals')
        .select('*')
        .eq('status', 'pending')
        .order('suggested_at', { ascending: false })
      setProposals((data as Proposal[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleStatus(id: string, status: 'approved' | 'edited' | 'rejected') {
    await supabase
      .from('agent_proposals')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', id)
    setProposals((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div style={{
      position: 'relative',
      zIndex: 1,
      maxWidth: 820,
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
          Inbox
        </h1>
        <p style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: 13,
          color: 'rgba(255,255,255,0.4)',
        }}>
          {loading ? 'Chargement...' : `${proposals.length} proposition(s) en attente`}
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
          Chargement...
        </p>
      )}

      {/* Empty state */}
      {!loading && proposals.length === 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: '64px 32px',
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 20,
          textAlign: 'center',
        }}>
          <span style={{ fontSize: 40 }}>✅</span>
          <p style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: 13,
            color: 'rgba(255,255,255,0.5)',
          }}>
            Inbox vide — toutes les propositions ont été traitées.
          </p>
        </div>
      )}

      {/* Proposal cards */}
      {!loading && proposals.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {proposals.map((proposal) => {
            const contentPreview =
              typeof proposal.content?.text === 'string'
                ? proposal.content.text
                : JSON.stringify(proposal.content, null, 2).slice(0, 400)

            return (
              <div
                key={proposal.id}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 20,
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                {/* Badges row */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  {/* Platform badges */}
                  {proposal.platform?.map((p) => (
                    <span
                      key={p}
                      className="text-xs bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/20 px-2 py-0.5 rounded-full"
                    >
                      {p}
                    </span>
                  ))}
                  {/* Proposal type badge */}
                  <span style={{
                    fontSize: 11,
                    fontFamily: 'Space Mono, monospace',
                    fontWeight: 700,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.55)',
                    padding: '2px 10px',
                    borderRadius: 999,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase' as const,
                  }}>
                    {proposal.proposal_type}
                  </span>
                </div>

                {/* Title */}
                <p className="text-white font-semibold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {proposal.title}
                </p>

                {/* Optimal publish time */}
                {proposal.optimal_publish_at && (
                  <p style={{
                    fontFamily: 'Space Mono, monospace',
                    fontSize: 12,
                    color: '#00E5FF',
                    opacity: 0.8,
                  }}>
                    📅{' '}
                    {new Date(proposal.optimal_publish_at).toLocaleDateString('fr-FR', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}

                {/* Justification */}
                {proposal.justification && (
                  <div className="bg-white/5 rounded-xl p-3 border-l-2 border-[#00E5FF]/40 text-white/50 text-sm">
                    💡 {proposal.justification}
                  </div>
                )}

                {/* Content preview */}
                <p
                  className="whitespace-pre-wrap line-clamp-4 text-white/70 text-sm"
                  style={{ fontFamily: 'Space Mono, monospace' }}
                >
                  {contentPreview}
                </p>

                {/* Divider */}
                <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => handleStatus(proposal.id, 'approved')}
                    className="flex-1 py-2.5 rounded-xl bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF]"
                    style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Approuver
                  </button>
                  <button
                    onClick={() => handleStatus(proposal.id, 'edited')}
                    className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60"
                    style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Éditer
                  </button>
                  <button
                    onClick={() => handleStatus(proposal.id, 'rejected')}
                    className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400"
                    style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Rejeter
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
