import { useCallback, useEffect, useState } from 'react'
import { Play, Square, RotateCcw, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

const API = '/api/v1/codegraph'

const s = {
  root: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '10px 16px', borderBottom: '1px solid var(--border)',
    background: 'var(--bg-surface)', flexShrink: 0,
  },
  dot: (running) => ({
    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
    background: running ? 'var(--success)' : 'var(--text-dim)',
    boxShadow: running ? '0 0 6px var(--success)' : 'none',
  }),
  label: { fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 },
  meta: { fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--f-mono)', flex: 1 },
  btn: {
    display: 'flex', alignItems: 'center', gap: '5px',
    background: 'transparent', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '4px 10px',
    cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '12px',
    transition: 'border-color 150ms, color 150ms', flexShrink: 0,
  },
  startBtn: {
    display: 'flex', alignItems: 'center', gap: '5px',
    background: 'var(--accent-grad)', color: '#000', fontWeight: 700,
    border: 'none', borderRadius: 'var(--radius-sm)', padding: '4px 12px',
    cursor: 'pointer', fontSize: '12px', flexShrink: 0,
  },
}

export default function IndexStatus({ workspaceId, repoPath, onStatusChange }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(() => {
    if (!workspaceId) return
    fetch(`${API}/${workspaceId}/status`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        setStatus(data)
        onStatusChange?.(data)
      })
      .catch(() => {})
  }, [workspaceId, onStatusChange])

  useEffect(() => { refresh() }, [refresh])

  const handleStart = async () => {
    if (!repoPath) return
    setLoading(true)
    try {
      const r = await fetch(`${API}/${workspaceId}/start?repo_path=${encodeURIComponent(repoPath)}`, { method: 'POST' })
      if (r.ok) { await new Promise((res) => setTimeout(res, 800)); refresh() }
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async () => {
    setLoading(true)
    try {
      await fetch(`${API}/${workspaceId}/stop`, { method: 'POST' })
      refresh()
    } finally {
      setLoading(false)
    }
  }

  const running = status?.running
  const port = status?.port
  const binExists = status?.bin_exists

  return (
    <div style={s.root}>
      <div style={s.dot(running)} />
      <span style={s.label}>Codegraph</span>
      <span style={s.meta}>
        {running
          ? `● port ${port}`
          : binExists
            ? 'stopped'
            : 'binary not found — run: cd codegraph && npm run build'}
      </span>

      {running ? (
        <>
          <button
            style={s.btn}
            onClick={refresh}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            <RotateCcw size={11} /> Reindex
          </button>
          <button
            style={{ ...s.btn, color: 'var(--error)', borderColor: 'var(--error-soft)' }}
            onClick={handleStop}
            disabled={loading}
          >
            <Square size={11} /> Stop
          </button>
        </>
      ) : (
        <button
          style={{ ...s.startBtn, opacity: (loading || !binExists || !repoPath) ? 0.6 : 1, cursor: (loading || !binExists || !repoPath) ? 'default' : 'pointer' }}
          onClick={handleStart}
          disabled={loading || !binExists || !repoPath}
        >
          {loading ? <Loader2 size={11} /> : <Play size={11} />}
          {loading ? 'Starting…' : 'Start indexer'}
        </button>
      )}
    </div>
  )
}
