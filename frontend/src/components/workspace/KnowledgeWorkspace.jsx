import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, RefreshCw, FileText, AlignLeft, Upload } from 'lucide-react'
import Modal from '../ui/Modal'

const API = '/api/v1/chiron'

const STATUS_COLOR = {
  pending:    'text-argo-muted',
  processing: 'text-yellow-400',
  done:       'text-green-400',
  error:      'text-argo-error',
}

function SourceCard({ source }) {
  const name = source.file_path?.split('/').pop() ?? source.file_path
  const color = STATUS_COLOR[source.status] ?? 'text-argo-muted'
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-argo-border bg-argo-elevated hover:border-argo-cyan/30 transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <FileText size={13} className="text-argo-muted flex-shrink-0" />
        <span className="text-xs text-argo-primary truncate">{name}</span>
        <span className={`text-[10px] font-semibold ml-1 flex-shrink-0 ${color}`}>{source.status}</span>
      </div>
      <span className="text-[10px] text-argo-muted flex-shrink-0 ml-2">{source.mime_type?.split('/')[1]}</span>
    </div>
  )
}

export default function KnowledgeWorkspace({ workspaceId }) {
  const [sources, setSources]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [addTab, setAddTab]     = useState('file')   // 'file' | 'text'
  const [text, setText]         = useState({ name: '', content: '' })
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    try {
      const r = await fetch(`${API}/${workspaceId}/sources`)
      if (r.ok) setSources(await r.json())
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  const ingestText = async () => {
    if (!text.name.trim() || !text.content.trim()) return
    setSubmitting(true)
    try {
      await fetch(`${API}/${workspaceId}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: text.name, content: text.content, mime_type: 'text/plain' }),
      })
      setText({ name: '', content: '' })
      setModalOpen(false)
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  const ingestFile = async (file) => {
    if (!file) return
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await fetch(`${API}/${workspaceId}/upload`, { method: 'POST', body: fd })
      setModalOpen(false)
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  const handleFileDrop = useCallback((e) => {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (file) ingestFile(file)
  }, [workspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!workspaceId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-argo-muted">Select a workspace to manage knowledge bases.</p>
      </div>
    )
  }

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleFileDrop}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-argo-border flex-shrink-0">
        <span className="text-xs font-semibold text-argo-secondary">
          Knowledge Sources
          {sources.length > 0 && (
            <span className="ml-2 text-argo-muted font-normal">({sources.length})</span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="Refresh sources"
            className="w-7 h-7 flex items-center justify-center rounded text-argo-muted hover:text-argo-secondary hover:bg-argo-elevated transition-colors disabled:opacity-40"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-argo-cyan text-[#001218] hover:opacity-90 transition-opacity"
          >
            <Plus size={12} />
            Add content
          </button>
        </div>
      </div>

      {/* Source list */}
      <div className="flex-1 overflow-y-auto p-5">
        {sources.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-argo-muted">
            <Upload size={28} strokeWidth={1.5} />
            <p className="text-xs text-center">
              No sources yet.<br />
              Drop a file here or click <strong className="text-argo-secondary">Add content</strong>.
            </p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {sources.map((s) => <SourceCard key={s.id} source={s} />)}
        </div>
      </div>

      {/* Add content modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add content" size="md">
        <div className="px-5 pb-5">
          {/* Tab switcher */}
          <div className="flex gap-1 mb-4 bg-argo-elevated rounded-lg p-1 border border-argo-border w-fit">
            {[
              { id: 'file', icon: Upload,    label: 'File upload' },
              { id: 'text', icon: AlignLeft, label: 'Paste text'  },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setAddTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  addTab === id ? 'bg-argo-surface text-argo-primary' : 'text-argo-muted hover:text-argo-secondary'
                }`}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>

          {addTab === 'file' && (
            <div
              className="border-2 border-dashed border-argo-border rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-argo-cyan/40 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); ingestFile(e.dataTransfer?.files?.[0]) }}
            >
              <Upload size={24} strokeWidth={1.5} className="text-argo-muted" />
              <p className="text-xs text-argo-muted text-center">
                Drop a file here or click to browse<br />
                <span className="text-[10px]">txt, md, csv, json, py, js, yaml — up to 50 MB</span>
              </p>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".txt,.md,.csv,.json,.py,.js,.yaml,.yml,.html"
                onChange={(e) => ingestFile(e.target.files?.[0])}
              />
              {submitting && <span className="text-xs text-argo-cyan">Uploading…</span>}
            </div>
          )}

          {addTab === 'text' && (
            <div className="flex flex-col gap-3">
              <input
                value={text.name}
                onChange={(e) => setText((t) => ({ ...t, name: e.target.value }))}
                placeholder="Document name (e.g. notes.md)"
                className="w-full bg-argo-elevated border border-argo-border rounded-lg px-3 py-2 text-sm text-argo-primary outline-none focus:border-argo-cyan transition-colors"
              />
              <textarea
                value={text.content}
                onChange={(e) => setText((t) => ({ ...t, content: e.target.value }))}
                rows={8}
                placeholder="Paste or type your content here…"
                className="w-full bg-argo-elevated border border-argo-border rounded-lg px-3 py-2 text-sm text-argo-primary resize-y outline-none focus:border-argo-cyan transition-colors font-mono"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={ingestText}
                  disabled={submitting || !text.name.trim() || !text.content.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-argo-cyan text-[#001218] disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                >
                  {submitting ? 'Ingesting…' : 'Ingest text'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
