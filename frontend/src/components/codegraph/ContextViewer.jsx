import { useEffect, useState } from 'react'
import { FileCode, Copy, Check, ChevronRight, Loader2, AlertCircle } from 'lucide-react'

const API = '/api/v1/codegraph'

const s = {
  root: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 },
  header: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 14px', borderBottom: '1px solid var(--border)',
    background: 'var(--bg-surface)', flexShrink: 0,
  },
  breadcrumb: {
    display: 'flex', alignItems: 'center', gap: '4px',
    fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--f-mono)',
    flex: 1, overflow: 'hidden',
  },
  breadcrumbPart: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  copyBtn: {
    background: 'transparent', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '3px 7px',
    cursor: 'pointer', color: 'var(--text-dim)', fontSize: '11px',
    display: 'flex', alignItems: 'center', gap: '4px',
    transition: 'border-color 150ms, color 150ms', flexShrink: 0,
  },
  body: { flex: 1, overflowY: 'auto' },
  pre: {
    margin: 0, padding: '16px',
    fontFamily: 'var(--f-mono)', fontSize: '12px',
    lineHeight: 1.7, color: 'var(--text-primary)',
    background: 'transparent',
    whiteSpace: 'pre', overflowX: 'auto',
  },
  lineNo: {
    display: 'inline-block', width: '36px', textAlign: 'right',
    marginRight: '16px', color: 'var(--text-dim)', userSelect: 'none',
    fontSize: '11px',
  },
  empty: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '10px', padding: '48px 24px',
    color: 'var(--text-dim)', fontSize: '12px',
  },
  loading: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '8px', color: 'var(--text-dim)', fontSize: '12px',
  },
  errorBox: {
    margin: '16px', padding: '12px 16px',
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--error)',
    fontFamily: 'var(--f-mono)', display: 'flex', alignItems: 'center', gap: '8px',
  },
  metaRow: {
    padding: '8px 16px', borderTop: '1px solid var(--border)',
    display: 'flex', gap: '16px', flexShrink: 0,
    background: 'var(--bg-surface)',
  },
  metaChip: { fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--f-mono)' },
}

function CodeLines({ code, startLine = 1 }) {
  const lines = (code || '').split('\n')
  return (
    <pre style={s.pre}>
      {lines.map((line, i) => (
        <div key={i}>
          <span style={s.lineNo}>{startLine + i}</span>
          {line}
        </div>
      ))}
    </pre>
  )
}

export default function ContextViewer({ workspaceId, symbol }) {
  const [context, setContext] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!workspaceId || !symbol) { setContext(null); setError(null); return }
    setLoading(true)
    setError(null)
    fetch(`${API}/${workspaceId}/context?file=${encodeURIComponent(symbol.file)}&line=${symbol.line}&name=${encodeURIComponent(symbol.name)}`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(setContext)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [workspaceId, symbol])

  const handleCopy = () => {
    if (!context?.code) return
    navigator.clipboard.writeText(context.code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  if (!symbol) {
    return (
      <div style={{ ...s.root, justifyContent: 'center' }}>
        <div style={s.empty}>
          <FileCode size={28} style={{ opacity: 0.25 }} />
          <span>Select a symbol to view its context</span>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ ...s.root, justifyContent: 'center' }}>
        <div style={s.loading}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          Loading context…
        </div>
      </div>
    )
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <FileCode size={13} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
        <div style={s.breadcrumb}>
          <span style={s.breadcrumbPart}>{symbol.file}</span>
          <ChevronRight size={11} />
          <span style={{ color: 'var(--accent)', flexShrink: 0 }}>{symbol.name}</span>
        </div>
        <button
          style={s.copyBtn}
          onClick={handleCopy}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
          disabled={!context?.code}
        >
          {copied ? <Check size={11} style={{ color: 'var(--success)' }} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div style={s.body}>
        {error && (
          <div style={s.errorBox}>
            <AlertCircle size={13} />
            {error}
          </div>
        )}
        {context?.code && <CodeLines code={context.code} startLine={context.start_line ?? symbol.line} />}
        {!error && !context?.code && (
          <div style={{ ...s.empty, justifyContent: 'center' }}>
            <span>No code context available</span>
          </div>
        )}
      </div>

      {context && (
        <div style={s.metaRow}>
          <span style={s.metaChip}>line {symbol.line}</span>
          {context.language && <span style={s.metaChip}>{context.language}</span>}
          {context.code && <span style={s.metaChip}>{context.code.split('\n').length} lines</span>}
        </div>
      )}
    </div>
  )
}
