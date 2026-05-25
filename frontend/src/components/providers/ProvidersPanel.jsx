import { useState, useEffect, useCallback } from 'react'
import ProviderCard from './ProviderCard'
import FallbackChainEditor from './FallbackChainEditor'
import ProviderConfigTab from './ProviderConfigTab'
import ModelSelector from './ModelSelector'

const PROVIDER_ORDER = ['claude_cli', 'nim', 'ollama', 'anthropic']

export default function ProvidersPanel() {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [resetting, setResetting] = useState(false)
  const [tab, setTab] = useState('status')

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/providers/health')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setHealth(data)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 10000)
    return () => clearInterval(interval)
  }, [fetchHealth])

  const handleReset = async () => {
    setResetting(true)
    try {
      await fetch('/api/v1/providers/health/reset', { method: 'POST' })
      await fetchHealth()
    } finally {
      setResetting(false)
    }
  }

  const activeLocks = health
    ? Object.values(health.model_locks || {}).filter((h) => h.tech_locked).length
    : 0

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-base)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '16px 20px 0',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: 'var(--f-display)',
                fontWeight: 700,
                fontSize: '16px',
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              Model Providers
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {activeLocks > 0 ? (
                <span style={{ color: 'var(--status-error)' }}>
                  ⚠ {activeLocks} model{activeLocks > 1 ? 's' : ''} rate-limited
                </span>
              ) : health ? (
                <span style={{ color: 'var(--status-success)' }}>All providers healthy</span>
              ) : (
                'Loading...'
              )}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {activeLocks > 0 && (
              <button
                className="btn btn-ghost"
                onClick={handleReset}
                disabled={resetting}
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                {resetting ? 'Resetting...' : 'Clear Locks'}
              </button>
            )}
            <button
              className="btn btn-ghost"
              onClick={fetchHealth}
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              Refresh
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 0 }}>
          {['status', 'chains', 'configure'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontFamily: 'var(--f-ui)',
                background: 'none',
                border: 'none',
                borderBottom: tab === t ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontWeight: tab === t ? 600 : 400,
                transition: 'color 0.15s',
                textTransform: 'capitalize',
              }}
            >
              {t === 'status' ? 'Provider Status' : t === 'chains' ? 'Fallback Chains' : 'Configure'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {loading && (
          <div
            style={{
              color: 'var(--text-muted)',
              fontSize: '13px',
              textAlign: 'center',
              paddingTop: 40,
            }}
          >
            Loading provider status...
          </div>
        )}

        {error && (
          <div
            style={{
              padding: 16,
              background: 'rgba(255,77,106,0.08)',
              border: '1px solid rgba(255,77,106,0.2)',
              borderRadius: 'var(--r-md)',
              color: 'var(--status-error)',
              fontSize: '12px',
              fontFamily: 'var(--f-mono)',
            }}
          >
            Failed to load: {error}
          </div>
        )}

        {!loading && !error && health && tab === 'status' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Claude model switcher — always shown first */}
            <div
              style={{
                padding: '14px 16px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-lg)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                  Active Claude Model
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>like /model in Claude Code</span>
              </div>
              <ModelSelector compact={false} />
            </div>

            {/* Provider health cards */}
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
                paddingBottom: 4,
              }}
            >
              Backend Providers
            </div>
            {PROVIDER_ORDER.map((pid) => {
              const pData = health.providers?.[pid]
              if (!pData) return null
              return (
                <ProviderCard
                  key={pid}
                  providerId={pid}
                  providerData={pData}
                  modelLocks={health.model_locks}
                />
              )
            })}
          </div>
        )}

        {!loading && !error && tab === 'chains' && <FallbackChainEditor />}

        {tab === 'configure' && <ProviderConfigTab />}
      </div>
    </div>
  )
}
