/**
 * LocalModelSelector — dropdown for picking the local Ollama model.
 *
 * Fetches /api/v1/providers/local-models (ArgoHarness endpoint).
 * Selection is persisted to localStorage and passed to the chat request
 * via the `user_model` field so OllamaCodeSession can use it.
 *
 * Tier badges:
 *   tier 1 — cyan  (fast, simple tasks)
 *   tier 2 — amber (complex coding, 262K context, thinking)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { BrainCircuit } from 'lucide-react'
import { apiFetch } from '../../lib/api'

const LS_KEY = 'local_model_override'

const TIER_STYLE = {
  1: { label: 'Fast',    color: 'var(--accent-cyan)' },
  2: { label: 'Strong',  color: 'var(--accent-amber)' },
}

function TierBadge({ tier }) {
  const s = TIER_STYLE[tier] ?? TIER_STYLE[1]
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.06em', color: s.color,
      padding: '2px 6px', border: `1px solid ${s.color}40`,
      borderRadius: 999, background: `${s.color}10`, flexShrink: 0,
    }}>
      {s.label}
    </span>
  )
}

function CtxBadge({ contextWindow }) {
  const label = contextWindow >= 200_000 ? '262K' :
                contextWindow >= 100_000 ? `${Math.round(contextWindow / 1000)}K` :
                contextWindow >= 32_000  ? '32K' : '16K'
  return (
    <span style={{
      fontSize: 9, fontWeight: 600, color: 'var(--text-muted)',
      padding: '2px 5px', border: '1px solid var(--border)',
      borderRadius: 999, flexShrink: 0,
    }}>
      {label} ctx
    </span>
  )
}

export default function LocalModelSelector({ compact = true }) {
  const [models, setModels]         = useState([])
  const [selected, setSelected]     = useState(null)   // model id or null (= auto)
  const [ollamaUp, setOllamaUp]     = useState(true)
  const [open, setOpen]             = useState(false)
  const [loading, setLoading]       = useState(true)
  const ref = useRef(null)

  // Restore persisted selection on mount
  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY)
    if (stored) setSelected(stored)
  }, [])

  const fetchModels = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/v1/providers/local-models')
      if (!res.ok) return
      const data = await res.json()
      setOllamaUp(data.ollama_available ?? false)
      setModels(data.models ?? [])
    } catch {
      setOllamaUp(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchModels() }, [fetchModels])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const pick = (modelId) => {
    const value = modelId === '__auto__' ? null : modelId
    setSelected(value)
    if (value) localStorage.setItem(LS_KEY, value)
    else localStorage.removeItem(LS_KEY)
    setOpen(false)
  }

  const activeInfo = models.find((m) => m.id === selected)
  const displayName = selected
    ? (activeInfo?.label ?? selected).split(':')[0]   // trim tag for brevity
    : 'Auto'

  if (!compact) return null  // full variant not implemented yet

  // Don't render if Ollama is down and no models known
  if (!ollamaUp && models.length === 0 && !loading) return null

  const dotColor = ollamaUp ? '#00ff9d' : '#ef4444'
  const tierColor = activeInfo ? (TIER_STYLE[activeInfo.tier]?.color ?? '#00d4ff') : 'var(--text-muted)'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Select local AI model"
        style={{
          background: 'none', border: 'none', padding: 0,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
        }}
      >
        {/* Ollama status dot */}
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: dotColor, flexShrink: 0,
          boxShadow: ollamaUp ? `0 0 4px ${dotColor}` : 'none',
        }} />
        <span className="mono" style={{
          fontWeight: 600, fontSize: 11, color: tierColor,
          maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {loading ? '…' : displayName}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="var(--text-muted)" strokeWidth="2.5"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          minWidth: 280, maxHeight: 380, overflowY: 'auto', zIndex: 9999,
        }}>
          {/* Header */}
          <div style={{
            padding: '8px 12px', fontSize: 10, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'var(--text-muted)', borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>Local Model</span>
            <span style={{ color: ollamaUp ? '#00ff9d' : '#ef4444', fontSize: 9 }}>
              {ollamaUp ? '● Ollama Online' : '● Offline'}
            </span>
          </div>

          {/* Auto option */}
          {_ModelRow({ id: '__auto__', label: 'Auto (harness decides)', tier: null, installed: true,
            context_window: null, supports_thinking: false,
            isSelected: selected === null, onClick: pick })}

          {/* Installed models first */}
          {models.filter(m => m.installed).map(m =>
            _ModelRow({ ...m, isSelected: m.id === selected, onClick: pick, key: m.id })
          )}

          {/* Not installed */}
          {models.filter(m => !m.installed).length > 0 && (
            <div style={{
              padding: '6px 12px', fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              color: 'var(--text-muted)', borderTop: '1px solid var(--border)',
            }}>
              Not installed
            </div>
          )}
          {models.filter(m => !m.installed).map(m =>
            _ModelRow({ ...m, isSelected: false, onClick: pick, key: m.id, dimmed: true })
          )}

          {!ollamaUp && (
            <div style={{ padding: '12px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
              Start Ollama to enable local models
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function _ModelRow({ id, label, tier, installed, context_window, supports_thinking, isSelected, onClick, dimmed }) {
  return (
    <button
      key={id}
      onClick={() => onClick(id)}
      disabled={!installed && id !== '__auto__'}
      style={{
        display: 'flex', flexDirection: 'column', width: '100%',
        textAlign: 'left', padding: '9px 12px',
        background: isSelected ? 'rgba(0,212,255,0.06)' : 'none',
        border: 'none', borderBottom: '1px solid var(--border)',
        cursor: (installed || id === '__auto__') ? 'pointer' : 'default',
        opacity: dimmed ? 0.45 : 1,
        transition: 'background 0.12s',
      }}
      onMouseEnter={(e) => { if (!isSelected && (installed || id === '__auto__')) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = isSelected ? 'rgba(0,212,255,0.06)' : 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="mono" style={{
          fontSize: 12, fontWeight: isSelected ? 700 : 500, flex: 1,
          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {label ?? id}
        </span>
        {isSelected && <span style={{ fontSize: 9, color: 'var(--accent-cyan)', fontWeight: 700 }}>●</span>}
        {tier !== null && <TierBadge tier={tier} />}
        {context_window && <CtxBadge contextWindow={context_window} />}
      </div>
      {supports_thinking && (
        <span style={{ fontSize: 10, color: 'var(--accent-purple)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
          <BrainCircuit size={10} />thinking
        </span>
      )}
    </button>
  )
}

/**
 * Hook for reading the current local model selection from localStorage.
 * Use in the chat component to pass `user_model` to the send function.
 */
export function useLocalModel() {
  const [model, setModel] = useState(() => localStorage.getItem(LS_KEY) || null)

  useEffect(() => {
    const handler = () => setModel(localStorage.getItem(LS_KEY) || null)
    window.addEventListener('storage', handler)
    // Also poll every 500ms for same-tab changes (localStorage events don't fire in same tab)
    const interval = setInterval(handler, 500)
    return () => { window.removeEventListener('storage', handler); clearInterval(interval) }
  }, [])

  return model
}
