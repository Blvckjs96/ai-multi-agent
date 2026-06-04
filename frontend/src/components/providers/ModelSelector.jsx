import { useState, useEffect, useRef, useCallback } from 'react'
import { apiFetch } from '../../lib/api'

const MODEL_TIERS = {
  fast:     { label: 'Fast',     color: 'var(--accent-cyan)' },
  balanced: { label: 'Balanced', color: 'var(--accent-purple)' },
  powerful: { label: 'Powerful', color: 'var(--accent-amber)' },
}

export default function ModelSelector({ compact = false }) {
  const [models, setModels] = useState([])
  const [activeModel, setActiveModel] = useState(null)
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const ref = useRef(null)

  const fetchModels = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/providers/llm/models')
      if (!res.ok) return
      const data = await res.json()
      setModels(data.models || [])
      setActiveModel(data.active_model || null)
    } catch {
      // silent — status bar shouldn't break the page
    }
  }, [])

  useEffect(() => {
    fetchModels()
  }, [fetchModels])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selectModel = async (modelId) => {
    setSwitching(true)
    setOpen(false)
    try {
      const res = await apiFetch('/api/v1/providers/llm/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_id: modelId }),
      })
      if (res.ok) setActiveModel(modelId)
    } catch {
      // revert on error
      await fetchModels()
    } finally {
      setSwitching(false)
    }
  }

  const activeInfo = models.find((m) => m.id === activeModel)
  const displayName = activeInfo?.display_name ?? activeModel ?? 'claude-sonnet-4-6'
  const tier = activeInfo?.tier ?? 'balanced'
  const tierStyle = MODEL_TIERS[tier] ?? MODEL_TIERS.balanced

  if (compact) {
    return (
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={switching}
          title="Switch Claude model"
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: switching ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span className="grad-text mono" style={{ fontWeight: 600, fontSize: 11 }}>
            {switching ? '…' : displayName}
          </span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke={tierStyle.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.7, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {open && (
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              left: 0,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              minWidth: 260,
              zIndex: 9999,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '8px 12px',
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              Switch Claude Model
            </div>
            {models.map((m) => {
              const t = MODEL_TIERS[m.tier] ?? MODEL_TIERS.balanced
              const isActive = m.id === activeModel
              return (
                <button
                  key={m.id}
                  onClick={() => selectModel(m.id)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    background: isActive ? 'rgba(0,212,255,0.06)' : 'none',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span
                      className="mono"
                      style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                    >
                      {m.display_name}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: t.color,
                        padding: '2px 6px',
                        border: `1px solid ${t.color}40`,
                        borderRadius: 999,
                        background: `${t.color}10`,
                      }}
                    >
                      {t.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {m.description}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Full variant (used inside ProvidersPanel)
  return (
    <div ref={ref}>
      <div style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Active Claude Model
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {models.map((m) => {
          const t = MODEL_TIERS[m.tier] ?? MODEL_TIERS.balanced
          const isActive = m.id === activeModel
          return (
            <button
              key={m.id}
              onClick={() => selectModel(m.id)}
              disabled={isActive || switching}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: isActive ? 'rgba(0,212,255,0.06)' : 'var(--bg-surface)',
                border: isActive ? '1px solid rgba(0,212,255,0.3)' : '1px solid var(--border)',
                borderRadius: 'var(--r-md)',
                cursor: isActive ? 'default' : 'pointer',
                transition: 'all 0.15s',
                textAlign: 'left',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {m.display_name}
                  </span>
                  {isActive && (
                    <span style={{ fontSize: 10, color: 'var(--accent-cyan)', fontWeight: 700 }}>● active</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{m.description}</div>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: t.color,
                  padding: '3px 8px',
                  border: `1px solid ${t.color}40`,
                  borderRadius: 999,
                  background: `${t.color}10`,
                  flexShrink: 0,
                }}
              >
                {t.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
