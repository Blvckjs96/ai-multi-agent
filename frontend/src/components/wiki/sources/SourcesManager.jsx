import { useCallback, useEffect, useRef, useState } from 'react'
import { FolderOpen, Upload } from 'lucide-react'
import SourceCard from './SourceCard'

const API = '/api/v1/argon'
const POLL_INTERVAL = 3000

const s = {
  root: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  toolbar: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0,
  },
  uploadBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: 'var(--accent-grad)', color: '#000', fontWeight: 700,
    fontSize: '12px', padding: '5px 12px', borderRadius: 'var(--radius-sm)',
    border: 'none', cursor: 'pointer',
  },
  filter: {
    background: 'var(--bg-overlay)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '4px 8px',
    fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer',
  },
  count: { fontSize: '12px', color: 'var(--text-dim)', marginLeft: 'auto' },
  list: { flex: 1, overflow: 'auto' },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    height: '200px', gap: '10px', color: 'var(--text-dim)', fontSize: '13px',
  },
  loading: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '80px', color: 'var(--text-dim)', fontSize: '13px',
  },
  dropZone: {
    margin: '12px 14px', border: '2px dashed var(--border)', borderRadius: 'var(--radius-md)',
    padding: '24px', textAlign: 'center', cursor: 'pointer',
    fontSize: '13px', color: 'var(--text-dim)', transition: 'border-color 150ms',
  },
  planDialog: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  planModal: {
    width: '640px', maxWidth: '90vw', maxHeight: '80vh',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', boxShadow: 'var(--sh-3)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  planHeader: {
    padding: '16px 20px', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  planTitle: { fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' },
  planBody: { flex: 1, overflow: 'auto', padding: '16px 20px' },
  planFooter: {
    padding: '12px 20px', borderTop: '1px solid var(--border)',
    display: 'flex', gap: '8px', justifyContent: 'flex-end',
  },
  btnPrimary: {
    background: 'var(--accent-grad)', color: '#000', fontWeight: 700,
    fontSize: '13px', padding: '6px 16px', borderRadius: 'var(--radius-sm)',
    border: 'none', cursor: 'pointer',
  },
  btnDanger: {
    background: 'transparent', color: 'var(--error)', fontWeight: 600,
    fontSize: '13px', padding: '6px 16px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--error-soft)', cursor: 'pointer',
  },
  btnGhost: {
    background: 'transparent', color: 'var(--text-secondary)',
    fontSize: '13px', padding: '6px 16px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)', cursor: 'pointer',
  },
}

function PlanDialog({ source, onClose, onApprove, onReject }) {
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')

  useEffect(() => {
    fetch(`${API}/sources/${source.id}/plan`)
      .then((r) => r.ok ? r.json() : null)
      .then(setPlan)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [source.id])

  return (
    <div style={s.planDialog} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.planModal}>
        <div style={s.planHeader}>
          <span style={s.planTitle}>Compilation Plan</span>
          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{source.file_name}</span>
        </div>
        <div style={s.planBody}>
          {loading && <div style={{ color: 'var(--text-dim)', fontSize: '13px' }}>Loading plan…</div>}
          {!loading && plan && (
            <pre style={{ fontFamily: 'var(--f-mono)', fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {JSON.stringify(plan, null, 2)}
            </pre>
          )}
          {!loading && !plan && <div style={{ color: 'var(--text-dim)', fontSize: '13px' }}>No plan available</div>}
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em' }}>
              Note (optional)
            </div>
            <textarea
              style={{
                width: '100%', boxSizing: 'border-box', background: 'var(--bg-overlay)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                padding: '8px 10px', fontSize: '13px', color: 'var(--text-primary)',
                fontFamily: 'var(--f-ui)', resize: 'vertical', minHeight: '60px', outline: 'none',
              }}
              placeholder="Add feedback for regeneration…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <div style={s.planFooter}>
          <button style={s.btnGhost} onClick={onClose}>Cancel</button>
          <button style={s.btnDanger} onClick={() => onReject(source.id, note)}>Reject &amp; Regenerate</button>
          <button style={s.btnPrimary} onClick={() => onApprove(source.id)}>Approve Plan</button>
        </div>
      </div>
    </div>
  )
}

export default function SourcesManager({ workspaceId }) {
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [isDragOver, setIsDragOver] = useState(false)
  const [reviewSource, setReviewSource] = useState(null)
  const fileInputRef = useRef(null)
  const pollRef = useRef(null)

  const loadSources = useCallback(async () => {
    const params = new URLSearchParams()
    if (workspaceId) params.set('project_id', workspaceId)
    try {
      const r = await fetch(`${API}/sources?${params}`)
      if (r.ok) setSources(await r.json())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    loadSources()
    pollRef.current = setInterval(loadSources, POLL_INTERVAL)
    return () => clearInterval(pollRef.current)
  }, [loadSources])

  const uploadFile = async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    if (workspaceId) fd.append('project_id', workspaceId)
    try {
      const r = await fetch(`${API}/sources/upload`, { method: 'POST', body: fd })
      if (r.ok) loadSources()
    } catch {
      // ignore
    }
  }

  const handleFileInput = (e) => {
    Array.from(e.target.files || []).forEach(uploadFile)
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    Array.from(e.dataTransfer.files).forEach(uploadFile)
  }

  const handleRetry = async (id) => {
    await fetch(`${API}/sources/${id}/retry`, { method: 'POST' })
    loadSources()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this source?')) return
    await fetch(`${API}/sources/${id}`, { method: 'DELETE' })
    loadSources()
  }

  const handleApprove = async (id) => {
    await fetch(`${API}/sources/${id}/plan/approve`, { method: 'POST' })
    setReviewSource(null)
    loadSources()
  }

  const handleReject = async (id, note) => {
    await fetch(`${API}/sources/${id}/plan/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_note: note }),
    })
    setReviewSource(null)
    loadSources()
  }

  const FILTERS = ['all', 'processing', 'plan_ready', 'completed', 'error']
  const filtered = filter === 'all' ? sources : sources.filter((s) => s.status === filter)

  return (
    <div style={s.root}>
      <div style={s.toolbar}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileInput}
          accept=".pdf,.md,.mdx,.doc,.docx,.txt,.html"
        />
        <button style={{ ...s.uploadBtn, display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => fileInputRef.current?.click()}>
          <Upload size={12} /> Upload document
        </button>
        <select
          style={s.filter}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {FILTERS.map((f) => (
            <option key={f} value={f}>{f === 'all' ? 'All statuses' : f}</option>
          ))}
        </select>
        <span style={s.count}>{filtered.length} source{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div style={s.list}>
        <div
          style={{
            ...s.dropZone,
            borderColor: isDragOver ? 'var(--accent)' : 'var(--border)',
            background: isDragOver ? 'var(--accent-soft)' : 'transparent',
          }}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          Drop files here or click to upload
        </div>

        {loading && <div style={s.loading}>Loading sources…</div>}
        {!loading && filtered.length === 0 && (
          <div style={s.empty}>
            <FolderOpen size={32} style={{ opacity: 0.3 }} />
            <span>No sources yet — upload a document to get started</span>
          </div>
        )}
        {filtered.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            onRetry={handleRetry}
            onReviewPlan={setReviewSource}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {reviewSource && (
        <PlanDialog
          source={reviewSource}
          onClose={() => setReviewSource(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  )
}
