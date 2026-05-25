import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'

const API = '/api/v1/argon'

const s = {
  root: {
    display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
  },
  header: {
    padding: '16px 20px 12px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  title: {
    fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)',
    fontFamily: 'var(--f-display)', margin: 0,
  },
  meta: {
    display: 'flex', gap: '12px', alignItems: 'center', marginTop: '6px',
  },
  metaItem: {
    fontSize: '11px', color: 'var(--text-dim)',
  },
  tag: {
    fontSize: '10px', background: 'var(--accent-soft)', color: 'var(--accent)',
    borderRadius: '4px', padding: '1px 6px', fontWeight: 600,
  },
  actions: {
    display: 'flex', gap: '8px', marginTop: '8px',
  },
  btn: {
    fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)', background: 'transparent',
    color: 'var(--text-secondary)', cursor: 'pointer',
    transition: 'border-color 150ms, color 150ms',
  },
  body: {
    flex: 1, overflow: 'auto', padding: '20px',
  },
  loading: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', color: 'var(--text-dim)', fontSize: '13px',
  },
  empty: {
    padding: '40px 20px', textAlign: 'center',
    color: 'var(--text-dim)', fontSize: '13px',
  },
}

const mdComponents = {
  h1: ({ children }) => <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--f-display)', marginBottom: '12px' }}>{children}</h1>,
  h2: ({ children }) => <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px', marginTop: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>{children}</h2>,
  h3: ({ children }) => <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', marginTop: '20px' }}>{children}</h3>,
  p: ({ children }) => <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '12px' }}>{children}</p>,
  code: ({ inline, children }) => inline
    ? <code style={{ fontFamily: 'var(--f-mono)', fontSize: '12px', background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: '4px', color: 'var(--text-code)' }}>{children}</code>
    : <pre style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', overflow: 'auto', marginBottom: '16px' }}><code style={{ fontFamily: 'var(--f-mono)', fontSize: '12px', color: 'var(--text-code)' }}>{children}</code></pre>,
  ul: ({ children }) => <ul style={{ paddingLeft: '20px', marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.7 }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ paddingLeft: '20px', marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.7 }}>{children}</ol>,
  li: ({ children }) => <li style={{ marginBottom: '4px' }}>{children}</li>,
  blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid var(--accent)', paddingLeft: '16px', margin: '16px 0', color: 'var(--text-dim)', fontStyle: 'italic' }}>{children}</blockquote>,
  a: ({ href, children }) => <a href={href} style={{ color: 'var(--accent)', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">{children}</a>,
}

export default function WikiPage({ slug, scopeType, scopeId, onEdit, onBack }) {
  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    if (scopeType) params.set('scope_type', scopeType)
    if (scopeId) params.set('scope_id', scopeId)

    fetch(`${API}/wiki/pages/${slug}?${params}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(setPage)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [slug, scopeType, scopeId])

  if (!slug) return <div style={s.empty}>Select a page from the tree</div>
  if (loading) return <div style={s.loading}>Loading…</div>
  if (error) return <div style={{ ...s.empty, color: 'var(--error)' }}>Error: {error}</div>
  if (!page) return <div style={s.empty}>Page not found</div>

  const updatedAt = page.updated_at ? new Date(page.updated_at).toLocaleDateString() : null

  return (
    <div style={s.root}>
      <div style={s.header}>
        <h1 style={s.title}>{page.title}</h1>
        <div style={s.meta}>
          {updatedAt && <span style={s.metaItem}>Updated {updatedAt}</span>}
          {page.scope_type && (
            <span style={s.metaItem}>
              {page.scope_type === 'global' ? 'Global' : page.scope_name || page.scope_id}
            </span>
          )}
          {page.knowledge_type_slugs?.map((kt) => (
            <span key={kt} style={s.tag}>{kt}</span>
          ))}
        </div>
        <div style={s.actions}>
          {onBack && (
            <button
              style={s.btn}
              onClick={onBack}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              ← Back
            </button>
          )}
          {onEdit && (
            <button
              style={{ ...s.btn, color: 'var(--accent)', borderColor: 'var(--border-accent)' }}
              onClick={() => onEdit(page)}
            >
              Edit
            </button>
          )}
        </div>
      </div>
      <div style={s.body}>
        {page.summary && (
          <p style={{ fontSize: '14px', color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: '20px', lineHeight: 1.6 }}>
            {page.summary}
          </p>
        )}
        <ReactMarkdown components={mdComponents}>
          {page.content_md || '*No content yet.*'}
        </ReactMarkdown>
      </div>
    </div>
  )
}
