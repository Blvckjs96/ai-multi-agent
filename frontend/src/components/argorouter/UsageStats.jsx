import { useEffect, useState } from 'react'
import { TrendingUp, Coins, Zap } from 'lucide-react'

const API = '/api/v1/argorouter'

const MOCK_USAGE = {
  total_tokens: 1_284_500,
  total_cost_usd: 4.32,
  requests_today: 847,
  by_provider: [
    { provider: 'anthropic', tokens: 980000, cost: 3.92, pct: 76 },
    { provider: 'ollama',    tokens: 304500, cost: 0.00, pct: 24 },
  ],
}

const s = {
  root: { padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' },
  summaryRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' },
  metric: {
    padding: '16px 20px',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    display: 'flex', flexDirection: 'column', gap: '6px',
  },
  metricTop: { display: 'flex', alignItems: 'center', gap: '8px' },
  metricLabel: { fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.07em' },
  metricValue: { fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--f-mono)', letterSpacing: '-0.03em' },
  section: {
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', overflow: 'hidden',
  },
  sectionTitle: {
    padding: '12px 16px', fontSize: '11px', fontWeight: 700,
    color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.07em',
    borderBottom: '1px solid var(--border)',
  },
  providerRow: {
    padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px',
    borderBottom: '1px solid var(--border)',
  },
  providerTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  providerName: { fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' },
  providerCost: { fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'var(--f-mono)' },
  barTrack: { height: 4, background: 'var(--bg-overlay)', borderRadius: 2, overflow: 'hidden' },
  barFill: (pct) => ({
    height: '100%', width: `${pct}%`, borderRadius: 2,
    background: 'var(--accent-grad)', transition: 'width 600ms ease',
  }),
  providerMeta: { fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--f-mono)' },
}

function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

export default function UsageStats() {
  const [usage, setUsage] = useState(null)

  useEffect(() => {
    fetch(`${API}/usage`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setUsage(data || MOCK_USAGE))
      .catch(() => setUsage(MOCK_USAGE))
  }, [])

  const u = usage || MOCK_USAGE

  return (
    <div style={s.root}>
      <div style={s.summaryRow}>
        <div style={s.metric}>
          <div style={s.metricTop}>
            <Zap size={14} style={{ color: 'var(--accent)' }} />
            <span style={s.metricLabel}>Tokens</span>
          </div>
          <div style={s.metricValue}>{fmt(u.total_tokens)}</div>
        </div>
        <div style={s.metric}>
          <div style={s.metricTop}>
            <Coins size={14} style={{ color: 'var(--warning)' }} />
            <span style={s.metricLabel}>Cost</span>
          </div>
          <div style={s.metricValue}>${u.total_cost_usd?.toFixed(2)}</div>
        </div>
        <div style={s.metric}>
          <div style={s.metricTop}>
            <TrendingUp size={14} style={{ color: 'var(--success)' }} />
            <span style={s.metricLabel}>Requests</span>
          </div>
          <div style={s.metricValue}>{fmt(u.requests_today)}</div>
        </div>
      </div>

      <div style={s.section}>
        <div style={s.sectionTitle}>By provider</div>
        {(u.by_provider || []).map((p) => (
          <div key={p.provider} style={s.providerRow}>
            <div style={s.providerTop}>
              <span style={s.providerName}>{p.provider}</span>
              <span style={s.providerCost}>
                {fmt(p.tokens)} tok · ${p.cost?.toFixed(2)} · {p.pct}%
              </span>
            </div>
            <div style={s.barTrack}>
              <div style={s.barFill(p.pct)} />
            </div>
          </div>
        ))}
        {(!u.by_provider || u.by_provider.length === 0) && (
          <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-dim)' }}>
            No usage data yet
          </div>
        )}
      </div>
    </div>
  )
}
