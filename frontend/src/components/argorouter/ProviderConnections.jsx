import { useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, Clock, Plus, Trash2, RefreshCw } from 'lucide-react'

const API = '/api/v1/argorouter'

const PROVIDER_ICONS = {
  anthropic: '🟠',
  openai:    '🟢',
  gemini:    '🔵',
  ollama:    '⚫',
  mistral:   '🟣',
  groq:      '🟡',
}

const STATUS_META = {
  active:      { Icon: CheckCircle2, color: 'var(--success)', label: 'Active' },
  error:       { Icon: AlertCircle,  color: 'var(--error)',   label: 'Error' },
  pending:     { Icon: Clock,        color: 'var(--text-dim)', label: 'Pending' },
}

const s = {
  root: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' },
  toolbar: {
    display: 'flex', alignItems: 'center', gap: '8px',
  },
  addBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: 'var(--accent-grad)', color: '#000', fontWeight: 700,
    fontSize: '12px', padding: '6px 14px', borderRadius: 'var(--radius-sm)',
    border: 'none', cursor: 'pointer',
  },
  refreshBtn: {
    background: 'transparent', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '5px 8px',
    cursor: 'pointer', color: 'var(--text-secondary)',
    display: 'flex', alignItems: 'center',
    transition: 'border-color 150ms',
  },
  count: { fontSize: '12px', color: 'var(--text-dim)', marginLeft: 'auto' },
  card: {
    display: 'flex', alignItems: 'center', gap: '14px',
    padding: '14px 16px',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', transition: 'border-color 150ms',
  },
  emoji: { fontSize: '22px', flexShrink: 0, lineHeight: 1 },
  main: { flex: 1, minWidth: 0 },
  name: { fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' },
  sub: { fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px', fontFamily: 'var(--f-mono)' },
  statusBadge: {
    display: 'flex', alignItems: 'center', gap: '5px',
    fontSize: '11px', fontWeight: 600, flexShrink: 0,
  },
  deleteBtn: {
    background: 'transparent', border: '1px solid var(--error-soft)',
    borderRadius: 'var(--radius-sm)', padding: '4px 6px',
    cursor: 'pointer', color: 'var(--error)', flexShrink: 0,
    display: 'flex', alignItems: 'center',
    transition: 'background 150ms',
  },
  empty: {
    padding: '48px 24px', textAlign: 'center',
    color: 'var(--text-dim)', fontSize: '13px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
  },
  loading: { padding: '48px 24px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' },
}

const MOCK_PROVIDERS = [
  { id: 'anthropic-1', provider: 'anthropic', label: 'Claude (Anthropic)', endpoint: 'api.anthropic.com', status: 'active', models: 4 },
  { id: 'ollama-1',    provider: 'ollama',    label: 'Ollama (local)',      endpoint: 'localhost:11434', status: 'active', models: 3 },
]

export default function ProviderConnections() {
  const [providers, setProviders] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    fetch(`${API}/providers`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setProviders(Array.isArray(data) ? data : MOCK_PROVIDERS))
      .catch(() => setProviders(MOCK_PROVIDERS))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    if (!confirm('Remove this provider connection?')) return
    await fetch(`${API}/providers/${id}`, { method: 'DELETE' })
    load()
  }

  const list = providers || []

  return (
    <div style={s.root}>
      <div style={s.toolbar}>
        <button style={s.addBtn}>
          <Plus size={12} /> Add provider
        </button>
        <button
          style={s.refreshBtn}
          onClick={load}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-strong)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          <RefreshCw size={13} />
        </button>
        <span style={s.count}>{list.length} provider{list.length !== 1 ? 's' : ''}</span>
      </div>

      {loading && <div style={s.loading}>Loading providers…</div>}

      {!loading && list.length === 0 && (
        <div style={s.empty}>
          <Plus size={28} style={{ opacity: 0.3 }} />
          <span>No providers configured</span>
          <span style={{ fontSize: '12px' }}>Add a provider to start routing LLM requests</span>
        </div>
      )}

      {!loading && list.map((p) => {
        const sm = STATUS_META[p.status] || STATUS_META.pending
        return (
          <div
            key={p.id}
            style={s.card}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-strong)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <span style={s.emoji}>{PROVIDER_ICONS[p.provider] || '🔌'}</span>
            <div style={s.main}>
              <div style={s.name}>{p.label || p.provider}</div>
              <div style={s.sub}>{p.endpoint}{p.models ? ` · ${p.models} models` : ''}</div>
            </div>
            <div style={{ ...s.statusBadge, color: sm.color }}>
              <sm.Icon size={12} /> {sm.label}
            </div>
            <button
              style={s.deleteBtn}
              onClick={() => handleDelete(p.id)}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Trash2 size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
