'use client'

import { useState } from 'react'
import type { TextPost } from '@/lib/types'

type Props = {
  textPost: TextPost
  topic: string
  title: string
  onRegenerate: () => Promise<void>
}

function countWords(str: string) {
  return str.trim() === '' ? 0 : str.trim().split(/\s+/).length
}

function countChars(str: string) {
  return str.length
}

type Platform = 'linkedin' | 'instagram'

const PLATFORM_CONFIG = {
  linkedin: {
    label: 'LINKEDIN',
    color: '#4da3d4',
    bgColor: 'rgba(77,163,212,0.15)',
    borderColor: 'rgba(77,163,212,0.35)',
    maxWords: 1300,
    unit: 'mots',
    count: countWords,
  },
  instagram: {
    label: 'INSTAGRAM',
    color: '#e1306c',
    bgColor: 'rgba(225,48,108,0.15)',
    borderColor: 'rgba(225,48,108,0.35)',
    maxWords: 2200,
    unit: 'car.',
    count: countChars,
  },
}

export default function TextPostResult({ textPost, topic, title, onRegenerate }: Props) {
  const [linkedin, setLinkedin] = useState(textPost.linkedin)
  const [instagram, setInstagram] = useState(textPost.instagram)
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null)
  const [publishing, setPublishing] = useState<Platform | 'both' | null>(null)
  const [publishedPlatforms, setPublishedPlatforms] = useState<Platform[]>([])
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const content: Record<Platform, string> = { linkedin, instagram }
  const setContent: Record<Platform, (v: string) => void> = { linkedin: setLinkedin, instagram: setInstagram }

  async function handlePublish(platform: Platform) {
    setPublishing(platform)
    setError(null)
    try {
      const saveRes = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          topic,
          content_type: 'text',
          platforms: [platform],
          linkedin_text: platform === 'linkedin' ? linkedin : null,
          instagram_text: platform === 'instagram' ? instagram : null,
          status: 'draft',
        }),
      })
      if (!saveRes.ok) throw new Error('Sauvegarde échouée')
      const post = await saveRes.json()

      const pubRes = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id }),
      })
      if (!pubRes.ok) throw new Error('Publication échouée')
      setPublishedPlatforms(prev => [...prev, platform])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur publication')
    } finally {
      setPublishing(null)
    }
  }

  async function handlePublishBoth() {
    setPublishing('both')
    setError(null)
    try {
      const saveRes = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          topic,
          content_type: 'text',
          platforms: ['linkedin', 'instagram'],
          linkedin_text: linkedin,
          instagram_text: instagram,
          status: 'draft',
        }),
      })
      if (!saveRes.ok) throw new Error('Sauvegarde échouée')
      const post = await saveRes.json()

      const pubRes = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id }),
      })
      if (!pubRes.ok) throw new Error('Publication échouée')
      setPublishedPlatforms(['linkedin', 'instagram'])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur publication')
    } finally {
      setPublishing(null)
    }
  }

  async function handleRegenerate() {
    setRegenerating(true)
    setError(null)
    try {
      await onRegenerate()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur régénération')
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        {(['linkedin', 'instagram'] as Platform[]).map(platform => {
          const cfg = PLATFORM_CONFIG[platform]
          const text = content[platform]
          const cnt = cfg.count(text)
          const isEditing = editingPlatform === platform
          const isPublished = publishedPlatforms.includes(platform)

          return (
            <div key={platform} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
              {/* Platform header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, letterSpacing: '.06em' }}>{cfg.label}</span>
                  {isPublished && <span style={{ fontSize: 10, color: '#3dffa0' }}>✓ Publié</span>}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                  {cnt} / {cfg.maxWords} {cfg.unit}
                </div>
              </div>

              {/* Content area */}
              {isEditing ? (
                <textarea
                  value={text}
                  onChange={e => setContent[platform](e.target.value)}
                  style={{
                    flex: 1,
                    padding: 14,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 10,
                    color: '#fff',
                    fontSize: 12,
                    lineHeight: 1.7,
                    resize: 'none',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              ) : (
                <div style={{
                  flex: 1,
                  padding: 14,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.75)',
                  lineHeight: 1.7,
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                }}>
                  {text}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setEditingPlatform(isEditing ? null : platform)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
                  }}
                >{isEditing ? '✓ OK' : '✏️ Éditer'}</button>
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
                    opacity: regenerating ? 0.5 : 1,
                  }}
                >{regenerating ? '…' : '🔄 Régénérer'}</button>
                <button
                  onClick={() => handlePublish(platform)}
                  disabled={!!publishing || isPublished}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8,
                    background: cfg.bgColor, border: `1px solid ${cfg.borderColor}`,
                    fontSize: 11, fontWeight: 700, color: cfg.color, cursor: 'pointer',
                    opacity: (!!publishing || isPublished) ? 0.5 : 1,
                  }}
                >{publishing === platform ? '…' : isPublished ? '✓' : 'Publier →'}</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <div style={{ fontSize: 12, color: '#ff4f6f', padding: '8px 12px', background: 'rgba(255,79,111,0.08)', borderRadius: 8 }}>
          {error}
        </div>
      )}

      {/* Bottom CTA */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handlePublishBoth}
          disabled={!!publishing || publishedPlatforms.length === 2}
          style={{
            flex: 1, padding: '10px 0', borderRadius: 8,
            background: 'rgba(79,111,255,0.9)', border: 'none',
            fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer',
            opacity: (!!publishing || publishedPlatforms.length === 2) ? 0.5 : 1,
          }}
        >
          {publishing === 'both' ? 'Publication…' : publishedPlatforms.length === 2 ? '✓ Les 2 publiés' : 'Publier les 2 plateformes →'}
        </button>
        <button
          style={{
            padding: '10px 16px', borderRadius: 8,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
          }}
        >📅 Planifier</button>
      </div>
    </div>
  )
}
