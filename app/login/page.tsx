'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f1225',
      padding: 24,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        padding: '40px 32px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
      }}>
        <h1 style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 800,
          fontSize: 28,
          marginBottom: 8,
          color: '#fff',
        }}>
          0Flaw Content Hub
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 32 }}>
          Connecte-toi pour accéder à ton espace.
        </p>

        {sent ? (
          <div style={{
            padding: '16px 20px',
            background: 'rgba(61,255,160,0.08)',
            border: '1px solid rgba(61,255,160,0.25)',
            borderRadius: 12,
            fontSize: 13,
            color: 'var(--green, #3dffa0)',
            lineHeight: 1.6,
          }}>
            Email envoyé à <strong>{email}</strong>. Clique sur le lien pour te connecter.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6 }}>
                Adresse email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ton@email.com"
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
              <div style={{ fontSize: 12, color: 'var(--red, #ff4f6f)', padding: '8px 12px', background: 'rgba(255,79,111,0.08)', borderRadius: 8 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !email}
              style={{ marginTop: 4 }}
            >
              {loading ? 'Envoi...' : 'Recevoir le lien de connexion'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
