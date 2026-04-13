import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary'

export const metadata: Metadata = {
  title: '0Flaw Content Hub',
  description: 'Gestion de contenu LinkedIn & Instagram pour 0Flaw',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <main style={{
          flex: 1,
          marginLeft: 'var(--sidebar-w)',
          padding: '32px',
          position: 'relative',
          zIndex: 1,
          transition: 'margin-left 0.25s ease',
          minWidth: 0,
        }}>
          <GlobalErrorBoundary>
            {children}
          </GlobalErrorBoundary>
        </main>
      </body>
    </html>
  )
}
