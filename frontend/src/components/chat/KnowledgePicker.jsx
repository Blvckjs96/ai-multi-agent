import { useEffect, useRef, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { API_ORIGIN } from '../../lib/api'

export default function KnowledgePicker({ workspaceId, onSelect, onClose }) {
  const [sources, setSources] = useState([])
  const [filter, setFilter] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!workspaceId) return
    const token = localStorage.getItem('token')
    fetch(`${API_ORIGIN}/api/v1/chiron/${workspaceId}/sources`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setSources(d.items ?? []))
      .catch(() => {})
  }, [workspaceId])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filtered = sources.filter((s) =>
    s.name?.toLowerCase().includes(filter.toLowerCase())
  )

  useEffect(() => {
    setActiveIdx(0)
  }, [filter])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (filtered[activeIdx]) onSelect(filtered[activeIdx].name)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [filtered, activeIdx, onClose, onSelect])

  if (!workspaceId) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        marginBottom: '8px',
        width: '260px',
        borderRadius: '10px',
        border: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        zIndex: 30,
        animation: 'fade-up 120ms var(--ease-out) both',
      }}
    >
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
        <input
          ref={inputRef}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search knowledge bases…"
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '12px',
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
          }}
        />
      </div>
      <div style={{ maxHeight: '192px', overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '16px 12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
            {sources.length === 0 ? 'No knowledge bases found' : 'No matches'}
          </div>
        ) : (
          filtered.map((s, i) => (
            <button
              key={s.id ?? s.name}
              type="button"
              onClick={() => onSelect(s.name)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                textAlign: 'left',
                fontSize: '12px',
                border: 'none',
                cursor: 'pointer',
                background: i === activeIdx ? 'var(--bg-elevated)' : 'transparent',
                color: i === activeIdx ? 'var(--text-primary)' : 'var(--text-secondary)',
                transition: 'background 80ms',
              }}
            >
              <BookOpen size={11} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.name}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
