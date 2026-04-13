'use client'

import React from 'react'

type Props = { children: React.ReactNode }
type State = { hasError: boolean; message: string }

export class GlobalErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[GlobalErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: 16,
          padding: 32,
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 40,
            fontFamily: 'Syne, sans-serif',
            fontWeight: 800,
            color: 'var(--red, #ff4f6f)',
          }}>
            Erreur
          </div>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', maxWidth: 480 }}>
            Une erreur inattendue s&apos;est produite. Rechargez la page ou contactez le support.
          </p>
          {this.state.message && (
            <code style={{
              fontSize: 11,
              background: 'rgba(255,255,255,0.05)',
              padding: '8px 14px',
              borderRadius: 8,
              color: 'rgba(255,255,255,0.3)',
              maxWidth: 600,
              wordBreak: 'break-all',
            }}>
              {this.state.message}
            </code>
          )}
          <button
            className="btn btn-ghost"
            onClick={() => this.setState({ hasError: false, message: '' })}
            style={{ marginTop: 8 }}
          >
            Réessayer
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
