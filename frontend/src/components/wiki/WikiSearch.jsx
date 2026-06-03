import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'

const API = '/api/v1/argon'

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    paddingTop: '10vh', zIndex: 1000,
  },
  modal: {
    width: '560px', maxWidth: '90vw', background: 'var(--bg-elevated)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--sh-3)', overflow: 'hidden',
  },
  searchRow: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '14px 16px', borderBottom: '1px solid var(--border)',
  },
  icon: { fontSize: '16px', color: 'var(--text-dim)', flexShrink: 0 },
  input: {
    flex: 1, background: 'transparent', border: 'none', 
    fontSize: '15px', color: 'var(--text-primary)', fontFamily: 'var(--f-ui)',
  },
  badge: {
    fontSize: '10px', color: 'var(--text-dim)', background: 'var(--bg-overlay)',
    border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px',
    flexShrink: 0,
  },
  results: { maxHeight: '380px', overflow: 'auto' },
  empty: {
    padding: '24px 16px', textAlign: 'center',
    fontSize: '13px', color: 'var(--text-dim)',
  },
  item: {
    padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
    transition: 'background 100ms',
  },
  itemTitle: { fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' },
  itemMeta: { fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' },
  itemExcerpt: {
    fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px',
    lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis',
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
  },
  footer: {
    padding: '8px 16px', borderTop: '1px solid var(--border)',
    fontSize: '11px', color: 'var(--text-dim)',
    display: 'flex', gap: '16px',
  },
  shortcut: {
    display: 'flex', alignItems: 'center', gap: '4px',
  },
  key: {
    background: 'var(--bg-overlay)', border: '1px solid var(--border)',
    borderRadius: '3px', padding: '1px 5px', fontSize: '10px',
    color: 'var(--text-secondary)',
  },
}

export default function WikiSearch({ onSelect, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (!query.trim()) { setResults([]); return }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await fetch(`${API}/wiki/pages?limit=20&offset=0`)
        if (r.ok) {
          const pages = await r.json()
          const q = query.toLowerCase()
          const filtered = pages.filter((p) =>
            p.title?.toLowerCase().includes(q) || p.summary?.toLowerCase().includes(q)
          )
          setResults(filtered)
          setHighlighted(0)
        }
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(timerRef.current)
  }, [query])

  const handleKey = (e) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)) }
    if (e.key === 'Enter' && results[highlighted]) { onSelect(results[highlighted]); onClose() }
  }

  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.modal} role="dialog" aria-label="Wiki search">
        <div style={s.searchRow}>
          <Search size={16} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            style={s.input}
            placeholder="Search wiki pages…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
          />
          {loading && <span style={s.badge}>…</span>}
        </div>

        <div style={s.results}>
          {!query.trim() && (
            <div style={s.empty}>Type to search wiki pages</div>
          )}
          {query.trim() && results.length === 0 && !loading && (
            <div style={s.empty}>No pages found</div>
          )}
          {results.map((page, i) => (
            <div
              key={page.slug}
              style={{ ...s.item, background: i === highlighted ? 'var(--bg-hover)' : 'transparent' }}
              onMouseEnter={() => setHighlighted(i)}
              onClick={() => { onSelect(page); onClose() }}
            >
              <div style={s.itemTitle}>{page.title}</div>
              {page.scope_name && <div style={s.itemMeta}>{page.scope_name}</div>}
              {page.summary && <div style={s.itemExcerpt}>{page.summary}</div>}
            </div>
          ))}
        </div>

        <div style={s.footer}>
          <span style={s.shortcut}><span style={s.key}>↑↓</span> Navigate</span>
          <span style={s.shortcut}><span style={s.key}>↵</span> Open</span>
          <span style={s.shortcut}><span style={s.key}>Esc</span> Close</span>
        </div>
      </div>
    </div>
  )
}
