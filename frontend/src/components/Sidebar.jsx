/**
 * Sidebar — run history pulled from localStorage.
 *
 * Props:
 *   onSelectRun(description: string) — restore a past run's description
 *   currentDescription — active description (to skip re-running same)
 */

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'pipeline_history'
const MAX_HISTORY = 20

export function saveRunToHistory(description) {
  const entry = {
    id: Date.now(),
    description,
    timestamp: new Date().toISOString(),
    preview: description.slice(0, 60),
  }
  const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  // Avoid exact duplicates
  const deduped = existing.filter((e) => e.description !== description)
  const updated = [entry, ...deduped].slice(0, MAX_HISTORY)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return entry
}

function formatRelative(iso) {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function Sidebar({ onSelectRun }) {
  const [history, setHistory] = useState([])

  useEffect(() => {
    const load = () => {
      const items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      setHistory(items)
    }
    load()

    // Reload when another tab changes storage
    window.addEventListener('storage', load)
    return () => window.removeEventListener('storage', load)
  }, [])

  // Expose a way to refresh after a new run
  useEffect(() => {
    const handler = () => {
      const items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      setHistory(items)
    }
    window.addEventListener('pipeline_history_updated', handler)
    return () => window.removeEventListener('pipeline_history_updated', handler)
  }, [])

  return (
    <aside
      style={{
        width: '240px',
        flexShrink: 0,
        borderRight: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        position: 'sticky',
        top: 0,
        overflow: 'hidden',
      }}
    >
      {/* Logo area */}
      <div
        style={{
          padding: '20px 16px 16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
            }}
          >
            ⬡
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              SpecGen
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
              AI Multi-Agent
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 0',
        }}
      >
        {history.length === 0 ? (
          <div
            style={{
              padding: '20px 16px',
              fontSize: '12px',
              color: 'var(--text-dim)',
              textAlign: 'center',
              lineHeight: 1.6,
            }}
          >
            Your run history<br />will appear here.
          </div>
        ) : (
          history.map((entry) => (
            <button
              key={entry.id}
              onClick={() => onSelectRun(entry.description)}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '9px 16px',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                borderRadius: 0,
                transition: 'background 150ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <span
                style={{
                  fontSize: '12.5px',
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                  display: 'block',
                }}
              >
                {entry.preview}
              </span>
              <span style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>
                {formatRelative(entry.timestamp)}
              </span>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          fontSize: '11px',
          color: 'var(--text-dim)',
        }}
      >
        4 specialised AI agents
      </div>
    </aside>
  )
}
