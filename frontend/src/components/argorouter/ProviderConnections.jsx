import { useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, Clock, Plus, Trash2, RefreshCw, Bot, Globe, Cpu, Server, Zap, Layers, X } from 'lucide-react'

const API = '/api/v1/argorouter'

// Lucide icon per provider (no emoji)
const PROVIDER_ICON = {
  anthropic: Bot,
  openai:    Globe,
  gemini:    Zap,
  ollama:    Cpu,
  mistral:   Layers,
  groq:      Server,
}

const PROVIDER_COLOR = {
  anthropic: 'var(--provider-claude)',
  openai:    'var(--accent-green)',
  gemini:    'var(--accent-cyan)',
  ollama:    'var(--provider-ollama)',
  mistral:   'var(--accent-purple)',
  groq:      'var(--accent-amber)',
}

const STATUS_META = {
  active:  { Icon: CheckCircle2, color: 'var(--status-success)', label: 'Active' },
  error:   { Icon: AlertCircle,  color: 'var(--status-error)',   label: 'Error' },
  pending: { Icon: Clock,        color: 'var(--text-muted)',     label: 'Pending' },
}

const MOCK_PROVIDERS = [
  { id: 'anthropic-1', provider: 'anthropic', label: 'Claude (Anthropic)', endpoint: 'api.anthropic.com', status: 'active', models: 4 },
  { id: 'ollama-1',    provider: 'ollama',    label: 'Ollama (local)',     endpoint: 'localhost:11434',   status: 'active', models: 3 },
]

const s = {
  root:    { padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' },
  toolbar: { display: 'flex', alignItems: 'center', gap: '8px' },
  addBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: 'var(--accent-grad)', color: '#001218', fontWeight: 700,
    fontSize: '12px', padding: '6px 14px', borderRadius: 'var(--r-sm)',
    border: 'none', cursor: 'pointer',
    transition: 'opacity 120ms',
  },
  refreshBtn: {
    background: 'transparent', border: '1px solid var(--border)',
    borderRadius: 'var(--r-sm)', padding: '5px 8px', cursor: 'pointer',
    color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
    transition: 'border-color 150ms',
  },
  count: { fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto' },
  card: {
    display: 'flex', alignItems: 'center', gap: '14px',
    padding: '14px 16px',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)', transition: 'border-color 150ms',
  },
  main:  { flex: 1, minWidth: 0 },
  name:  { fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' },
  sub:   { fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'var(--f-mono)' },
  statusBadge: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, flexShrink: 0 },
  deleteBtn: {
    background: 'transparent', border: '1px solid var(--error-soft)',
    borderRadius: 'var(--r-sm)', padding: '4px 6px', cursor: 'pointer',
    color: 'var(--status-error)', flexShrink: 0, display: 'flex', alignItems: 'center',
    transition: 'background 150ms',
  },
  empty:   { padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' },
  loading: { padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' },
  banner: {
    padding: '10px 14px', borderRadius: 'var(--r-sm)', marginTop: 4,
    background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)',
    fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5,
    display: 'flex', alignItems: 'flex-start', gap: 10,
  },
}

export default function ProviderConnections() {
  const [providers, setProviders] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAddBanner, setShowAddBanner] = useState(false)

  const authHeaders = () => {
    const token = localStorage.getItem('token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  const load = () => {
    setLoading(true)
    fetch(`${API}/providers`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setProviders(Array.isArray(data) ? data : MOCK_PROVIDERS))
      .catch(() => setProviders(MOCK_PROVIDERS))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    if (!confirm('Remove this provider connection?')) return
    await fetch(`${API}/providers/${id}`, { method: 'DELETE', headers: authHeaders() })
    load()
  }

  const list = providers || []

  return (
    <div style={s.root}>
      <div style={s.toolbar}>
        <button
          type="button"
          style={s.addBtn}
          onClick={() => setShowAddBanner((v) => !v)}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
        >
          <Plus size={12} /> Add provider
        </button>
        <button
          type="button"
          style={s.refreshBtn}
          onClick={load}
          title="Refresh"
          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-strong)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          <RefreshCw size={13} />
        </button>
        <span style={s.count}>{list.length} provider{list.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Add provider info banner */}
      {showAddBanner && (
        <div style={s.banner}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>
              Provider connections are managed externally
            </p>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              To add or configure LLM providers, go to <strong>Providers</strong> in the sidebar.
              The Argorouter panel reflects connections from the routing service.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddBanner(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {loading && <div style={s.loading}>Loading providers…</div>}

      {!loading && list.length === 0 && (
        <div style={s.empty}>
          <Server size={28} style={{ opacity: 0.3 }} />
          <span>No providers configured</span>
          <span style={{ fontSize: '12px' }}>Add a provider to start routing LLM requests</span>
        </div>
      )}

      {!loading && list.map((p) => {
        const sm = STATUS_META[p.status] || STATUS_META.pending
        const IconComp = PROVIDER_ICON[p.provider] || Server
        const iconColor = PROVIDER_COLOR[p.provider] || 'var(--text-muted)'
        return (
          <div
            key={p.id}
            style={s.card}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-active)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--r-sm)',
              background: `${iconColor}14`, border: `1px solid ${iconColor}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <IconComp size={18} style={{ color: iconColor }} />
            </div>
            <div style={s.main}>
              <div style={s.name}>{p.label || p.provider}</div>
              <div style={s.sub}>{p.endpoint}{p.models ? ` · ${p.models} models` : ''}</div>
            </div>
            <div style={{ ...s.statusBadge, color: sm.color }}>
              <sm.Icon size={12} /> {sm.label}
            </div>
            <button
              type="button"
              style={s.deleteBtn}
              onClick={() => handleDelete(p.id)}
              title="Remove provider"
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,77,106,0.1)'}
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
