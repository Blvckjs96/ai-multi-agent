import { useEffect, useState } from 'react'
import { Wifi, WifiOff, RefreshCw, Server } from 'lucide-react'

const API = '/api/v1/argorouter'

const s = {
  root: {
    padding: '20px 24px',
    display: 'flex', flexDirection: 'column', gap: '20px',
  },
  hero: {
    display: 'flex', alignItems: 'center', gap: '16px',
    padding: '20px 24px',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
  },
  dot: (connected) => ({
    width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
    background: connected ? 'var(--success)' : 'var(--error)',
    boxShadow: connected ? '0 0 8px var(--success)' : '0 0 8px var(--error)',
  }),
  heroText: { flex: 1 },
  heroTitle: { fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' },
  heroSub: { fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' },
  refreshBtn: {
    background: 'transparent', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '6px 10px',
    cursor: 'pointer', color: 'var(--text-secondary)',
    display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px',
    transition: 'border-color 150ms, color 150ms',
  },
  grid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
  },
  metric: {
    padding: '16px 20px',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
  },
  metricLabel: { fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '6px' },
  metricValue: { fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--f-mono)' },
  metricSub: { fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' },
  errorBox: {
    padding: '12px 16px', background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)',
    fontSize: '12px', color: 'var(--error)', fontFamily: 'var(--f-mono)',
  },
}

export default function ArgorouterStatus() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = () => {
    setLoading(true)
    fetch(`${API}/status`)
      .then((r) => r.ok ? r.json() : { connected: false, error: 'HTTP ' + r.status })
      .then(setStatus)
      .catch((e) => setStatus({ connected: false, error: e.message }))
      .finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])

  const connected = status?.connected !== false && !status?.error

  return (
    <div style={s.root}>
      <div style={s.hero}>
        <div style={s.dot(connected)} />
        {connected
          ? <Wifi size={20} style={{ color: 'var(--success)', flexShrink: 0 }} />
          : <WifiOff size={20} style={{ color: 'var(--error)', flexShrink: 0 }} />
        }
        <div style={s.heroText}>
          <div style={s.heroTitle}>
            {connected ? 'Argorouter Connected' : 'Argorouter Offline'}
          </div>
          <div style={s.heroSub}>
            {connected
              ? `AI gateway · port 20128 · ${status?.version || 'v1'}`
              : 'Start Argorouter to enable multi-provider routing'}
          </div>
        </div>
        <button
          style={s.refreshBtn}
          onClick={refresh}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
        >
          <RefreshCw size={12} style={{ opacity: loading ? 0.5 : 1 }} />
          Refresh
        </button>
      </div>

      {status?.error && (
        <div style={s.errorBox}>{status.error}</div>
      )}

      <div style={s.grid}>
        <div style={s.metric}>
          <div style={s.metricLabel}>Port</div>
          <div style={s.metricValue}>20128</div>
          <div style={s.metricSub}>HTTP gateway</div>
        </div>
        <div style={s.metric}>
          <div style={s.metricLabel}>Uptime</div>
          <div style={s.metricValue}>{connected && status?.uptime ? status.uptime : '—'}</div>
          <div style={s.metricSub}>{connected ? 'running' : 'stopped'}</div>
        </div>
        <div style={s.metric}>
          <div style={s.metricLabel}>Requests today</div>
          <div style={s.metricValue}>{status?.requests_today ?? '—'}</div>
          <div style={s.metricSub}>across all providers</div>
        </div>
        <div style={s.metric}>
          <div style={s.metricLabel}>Active providers</div>
          <div style={s.metricValue}>{status?.active_providers ?? '—'}</div>
          <div style={s.metricSub}>configured connections</div>
        </div>
      </div>

      {!connected && (
        <div style={{ padding: '16px 20px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <Server size={16} style={{ color: 'var(--text-dim)' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Start Argorouter</span>
          </div>
          <pre style={{ fontFamily: 'var(--f-mono)', fontSize: '12px', color: 'var(--accent)', background: 'var(--bg-overlay)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', margin: 0 }}>
            cd argorouter && npm start
          </pre>
        </div>
      )}
    </div>
  )
}
