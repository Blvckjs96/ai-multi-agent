import { useCallback, useEffect, useState } from 'react'

const API = '/api/v1/chiron'

const label = (s) => ({ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: '8px' })

function EmptyState({ text }) {
  return <p style={{ fontSize: '13px', color: 'var(--text-dim)', textAlign: 'center', padding: '32px 0' }}>{text}</p>
}

function PageCard({ page, onOpen }) {
  return (
    <button
      onClick={() => onOpen(page)}
      style={{
        width: '100%',
        textAlign: 'left',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'border-color 150ms',
      }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-strong)'}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{page.title}</div>
      {page.summary && (
        <div style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {page.summary.slice(0, 120)}{page.summary.length > 120 ? '…' : ''}
        </div>
      )}
      {page.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' }}>
          {page.tags.map((t) => (
            <span key={t} style={{ fontSize: '11px', background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: '4px', padding: '1px 6px' }}>{t}</span>
          ))}
        </div>
      )}
    </button>
  )
}

function PageDetail({ page, workspaceId, onBack, onDelete }) {
  const [content, setContent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/${workspaceId}/pages/${page.id}`)
      .then((r) => r.json())
      .then((d) => { setContent(d.content); setLoading(false) })
      .catch(() => setLoading(false))
  }, [page.id, workspaceId])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '0 4px' }}>‹</button>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{page.title}</span>
        <button
          onClick={() => onDelete(page.id)}
          style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--error)', borderRadius: 'var(--radius-sm)', padding: '3px 10px', fontSize: '12px', cursor: 'pointer' }}
        >
          Delete
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
        {loading ? 'Loading…' : (content ?? 'No content')}
      </div>
    </div>
  )
}

function SearchResults({ results }) {
  if (!results) return null
  if (results.length === 0) return <EmptyState text="No results" />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {results.map((r) => (
        <div key={r.page_id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{r.title}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>score: {r.score.toFixed(3)}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>{r.snippet}</div>
        </div>
      ))}
    </div>
  )
}

export function ChironPanel({ workspaceId }) {
  const [tab, setTab] = useState('pages') // pages | search | ingest
  const [pages, setPages] = useState([])
  const [openPage, setOpenPage] = useState(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [ingestPath, setIngestPath] = useState('')
  const [ingestContent, setIngestContent] = useState('')
  const [ingesting, setIngesting] = useState(false)
  const [sources, setSources] = useState([])

  const loadPages = useCallback(() => {
    if (!workspaceId) return
    fetch(`${API}/${workspaceId}/pages`).then((r) => r.json()).then(setPages).catch(() => {})
    fetch(`${API}/${workspaceId}/sources`).then((r) => r.json()).then(setSources).catch(() => {})
  }, [workspaceId])

  useEffect(() => { loadPages() }, [loadPages])

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim() || !workspaceId) return
    setSearching(true)
    setResults(null)
    try {
      const res = await fetch(`${API}/${workspaceId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, top_k: 5 }),
      })
      const data = await res.json()
      setResults(data.results ?? [])
    } finally {
      setSearching(false)
    }
  }

  const handleIngest = async (e) => {
    e.preventDefault()
    if (!ingestPath.trim() || !ingestContent.trim() || !workspaceId) return
    setIngesting(true)
    try {
      await fetch(`${API}/${workspaceId}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: ingestPath, content: ingestContent }),
      })
      setIngestPath('')
      setIngestContent('')
      loadPages()
      setTab('pages')
    } finally {
      setIngesting(false)
    }
  }

  const handleDelete = async (pageId) => {
    if (!workspaceId) return
    await fetch(`${API}/${workspaceId}/pages/${pageId}`, { method: 'DELETE' })
    setOpenPage(null)
    loadPages()
  }

  if (!workspaceId) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: '14px', color: 'var(--text-dim)' }}>Select a workspace to use Chiron</p>
      </div>
    )
  }

  if (openPage) {
    return <PageDetail page={openPage} workspaceId={workspaceId} onBack={() => setOpenPage(null)} onDelete={handleDelete} />
  }

  const TabBtn = ({ id, label: lbl }) => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: '5px 14px',
        borderRadius: '9999px',
        border: tab === id ? '1px solid rgba(0,212,255,0.4)' : '1px solid transparent',
        background: tab === id ? 'rgba(0,212,255,0.08)' : 'transparent',
        color: tab === id ? '#00d4ff' : 'var(--text-dim)',
        fontSize: '12px',
        fontWeight: tab === id ? 600 : 400,
        cursor: 'pointer',
      }}
    >{lbl}</button>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: '4px', padding: '10px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <TabBtn id="pages" label={`Pages (${pages.length})`} />
        <TabBtn id="search" label="Search" />
        <TabBtn id="ingest" label="+ Ingest" />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Pages */}
        {tab === 'pages' && (
          pages.length === 0
            ? <EmptyState text="No wiki pages yet. Ingest a source to get started." />
            : pages.map((p) => <PageCard key={p.id} page={p} onOpen={setOpenPage} />)
        )}

        {/* Search */}
        {tab === 'search' && (
          <>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search knowledge base…"
                style={{
                  flex: 1,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={searching}
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: searching ? 0.6 : 1,
                }}
              >
                {searching ? '…' : 'Search'}
              </button>
            </form>
            <SearchResults results={results} />
          </>
        )}

        {/* Ingest */}
        {tab === 'ingest' && (
          <form onSubmit={handleIngest} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <p style={label()}>File path / title</p>
              <input
                value={ingestPath}
                onChange={(e) => setIngestPath(e.target.value)}
                placeholder="docs/api.md"
                style={{
                  width: '100%',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <p style={label()}>Content</p>
              <textarea
                value={ingestContent}
                onChange={(e) => setIngestContent(e.target.value)}
                placeholder="Paste markdown or plain text…"
                rows={10}
                style={{
                  width: '100%',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  fontFamily: 'monospace',
                  resize: 'vertical',
                }}
              />
            </div>
            <button
              type="submit"
              disabled={ingesting || !ingestPath.trim() || !ingestContent.trim()}
              style={{
                alignSelf: 'flex-start',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                opacity: ingesting ? 0.6 : 1,
              }}
            >
              {ingesting ? 'Ingesting…' : 'Ingest'}
            </button>
            {sources.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <p style={label()}>Ingested sources ({sources.length})</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {sources.map((s) => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 10px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{s.file_path}</span>
                      <span style={{ fontSize: '11px', color: s.status === 'done' ? 'var(--success)' : 'var(--warning)' }}>{s.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
