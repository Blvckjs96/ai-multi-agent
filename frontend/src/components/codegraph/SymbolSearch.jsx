import { useEffect, useRef, useState } from 'react'
import { Search, Code, Hash, Box, Braces, ArrowRight, Loader2 } from 'lucide-react'

const API = '/api/v1/codegraph'

const KIND_META = {
  function:  { Icon: Braces, color: 'var(--accent)' },
  class:     { Icon: Box,    color: 'var(--warning)' },
  variable:  { Icon: Hash,   color: 'var(--text-secondary)' },
  module:    { Icon: Code,   color: 'var(--success)' },
}

const s = {
  root: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 },
  searchBar: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 14px', borderBottom: '1px solid var(--border)',
    background: 'var(--bg-surface)', flexShrink: 0,
  },
  input: {
    flex: 1, background: 'transparent', border: 'none', 
    color: 'var(--text-primary)', fontSize: '13px',
    fontFamily: 'var(--f-mono)',
  },
  results: { flex: 1, overflowY: 'auto', padding: '8px' },
  row: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '8px 10px', borderRadius: 'var(--radius-sm)',
    cursor: 'pointer', transition: 'background 120ms',
  },
  rowIcon: { flexShrink: 0 },
  rowMain: { flex: 1, minWidth: 0 },
  rowName: { fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--f-mono)' },
  rowFile: { fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--f-mono)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowLine: { fontSize: '11px', color: 'var(--text-dim)', flexShrink: 0 },
  arrow: { flexShrink: 0, opacity: 0 },
  empty: { padding: '48px 24px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
  loading: { padding: '48px 24px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
}

export default function SymbolSearch({ workspaceId, onSymbolSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [hovered, setHovered] = useState(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim() || !workspaceId) { setResults([]); return }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await fetch(`${API}/${workspaceId}/symbols?q=${encodeURIComponent(query)}&limit=50`)
        const data = r.ok ? await r.json() : []
        setResults(Array.isArray(data) ? data : [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 220)
  }, [query, workspaceId])

  return (
    <div style={s.root}>
      <div style={s.searchBar}>
        <Search size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
        <input
          style={s.input}
          placeholder="Search symbols — functions, classes, variables…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        {loading && <Loader2 size={13} style={{ color: 'var(--text-dim)', animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
      </div>

      <div style={s.results}>
        {!loading && results.length === 0 && query.trim() && (
          <div style={s.empty}>
            <Search size={24} style={{ opacity: 0.25 }} />
            <span>No symbols found for "{query}"</span>
          </div>
        )}

        {!loading && results.length === 0 && !query.trim() && (
          <div style={s.empty}>
            <Code size={24} style={{ opacity: 0.25 }} />
            <span>Type to search symbols in the indexed codebase</span>
          </div>
        )}

        {results.map((sym, i) => {
          const meta = KIND_META[sym.kind] || KIND_META.variable
          const isHovered = hovered === i
          return (
            <div
              key={i}
              style={{ ...s.row, background: isHovered ? 'var(--bg-elevated)' : 'transparent' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSymbolSelect?.(sym)}
            >
              <meta.Icon size={14} style={{ ...s.rowIcon, color: meta.color }} />
              <div style={s.rowMain}>
                <div style={s.rowName}>{sym.name}</div>
                <div style={s.rowFile}>{sym.file}</div>
              </div>
              <span style={s.rowLine}>:{sym.line}</span>
              <ArrowRight size={12} style={{ ...s.arrow, opacity: isHovered ? 0.5 : 0 }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
