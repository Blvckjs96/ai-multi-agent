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

export function Sidebar({ onSelectRun, onNewRun }) {
  const [history, setHistory] = useState([])

  const load = () => {
    const items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    setHistory(items)
  }

  useEffect(() => {
    load()
    window.addEventListener('storage', load)
    window.addEventListener('pipeline_history_updated', load)
    return () => {
      window.removeEventListener('storage', load)
      window.removeEventListener('pipeline_history_updated', load)
    }
  }, [])

  return (
    <aside
      style={{
        width: '260px',
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
      {/* Brand */}
      <div style={{ padding: '20px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              flexShrink: 0,
            }}
          >
            ◎
          </div>
          <span
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-.015em',
            }}
          >
            SpecGen
          </span>
        </div>

        {/* New run button */}
        <button
          onClick={onNewRun}
          style={{
            width: '100%',
            background: 'transparent',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)',
            padding: '7px 12px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'background var(--duration-fast)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ fontSize: '16px', lineHeight: 1, color: 'var(--text-dim)' }}>+</span>
          New run
        </button>
      </div>

      {/* History */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 8px',
        }}
      >
        {history.length > 0 && (
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-dim)',
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              padding: '4px 8px 6px',
            }}
          >
            Recent
          </div>
        )}

        {history.length === 0 ? (
          <p
            style={{
              padding: '16px 8px',
              fontSize: '13px',
              color: 'var(--text-dim)',
              lineHeight: 1.55,
            }}
          >
            Your run history will appear here.
          </p>
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
                padding: '6px 8px',
                textAlign: 'left',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1px',
                transition: 'background var(--duration-fast)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <span
                style={{
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block',
                  maxWidth: '100%',
                }}
              >
                {entry.preview}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
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
          letterSpacing: '.02em',
        }}
      >
        Planner · Engineer · Cost Estimator · Writer
      </div>
    </aside>
  )
}
