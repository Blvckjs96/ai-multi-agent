import { useCallback, useEffect, useRef, useState } from 'react'
import { API_ORIGIN } from '../../lib/api'

const API_BASE = `${API_ORIGIN}/api/v1/coworkers`

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ── Default coworkers (seeded on first render if none exist) ──────────────────

const DEFAULTS = [
  { name: 'Tech Lead',   role: 'tech_lead',   model: 'opus',   system_prompt: 'You are a senior tech lead. Focus on architecture, code quality, and long-term maintainability. Always consider scalability and security implications. Prefer incremental, well-tested changes over large rewrites.' },
  { name: 'Developer',   role: 'developer',   model: 'sonnet', system_prompt: 'You are a focused developer. Write clean, tested, pattern-consistent code in small verified steps. Prefer the simplest solution that works. Follow existing conventions in the codebase.' },
  { name: 'Reviewer',    role: 'reviewer',    model: 'sonnet', system_prompt: 'You are a code reviewer. Hunt for bugs, security holes, and edge cases. Provide specific file and line references. Be direct about issues without being harsh.' },
  { name: 'Debugger',    role: 'debugger',    model: 'sonnet', system_prompt: 'You are a debugger. Focus on root causes, not band-aids. Reproduce the issue, trace the execution path, verify the fix actually works. Never guess — always confirm with evidence.' },
  { name: 'Brainstorm',  role: 'brainstorm',  model: 'sonnet', system_prompt: 'You are a brainstorming partner. Explore multiple approaches, discuss tradeoffs, and consider alternatives before committing to any solution. Ask clarifying questions freely.' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function CoworkerSelector({ value, onChange }) {
  const [coworkers, setCoworkers] = useState([])
  const [open, setOpen]           = useState(false)
  const [seeded, setSeeded]       = useState(false)
  const dropdownRef               = useRef(null)

  const fetchCoworkers = useCallback(async () => {
    try {
      const res = await fetch(API_BASE, { headers: authHeaders() })
      if (!res.ok) return
      const data = await res.json()
      setCoworkers(data)
      return data
    } catch {
      return []
    }
  }, [])

  // Seed defaults on first load if user has no coworkers
  useEffect(() => {
    if (seeded) return
    setSeeded(true)
    fetchCoworkers().then(async (data) => {
      if (!data || data.length > 0) return
      for (const d of DEFAULTS) {
        try {
          await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(d),
          })
        } catch { /* non-fatal */ }
      }
      fetchCoworkers()
    })
  }, [fetchCoworkers, seeded])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const active = value ? coworkers.find((c) => c.id === value) : null

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Select AI persona"
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: active ? 'rgba(167,139,250,0.1)' : 'transparent',
          border: `1px solid ${active ? 'rgba(167,139,250,0.3)' : 'var(--border)'}`,
          color: active ? 'var(--accent-purple)' : 'var(--text-muted)',
          padding: '2px 8px', borderRadius: 'var(--r-sm)',
          fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
          transition: 'all 120ms',
        }}
      >
        <span style={{ fontSize: 12 }}>◈</span>
        <span>{active ? active.name : 'Me'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 100,
          background: 'var(--bg-overlay)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          minWidth: 180, overflow: 'hidden',
        }}>
          {/* "Me" option — no persona */}
          <button
            onClick={() => { onChange(null); setOpen(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '8px 12px', border: 'none', cursor: 'pointer',
              background: !value ? 'rgba(255,255,255,0.06)' : 'transparent',
              color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit',
              textAlign: 'left',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', flexShrink: 0 }} />
            <span>Me</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>no persona</span>
          </button>

          {coworkers.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)' }}>
              {coworkers.map((cw) => (
                <button
                  key={cw.id}
                  onClick={() => { onChange(cw.id); setOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '8px 12px', border: 'none', cursor: 'pointer',
                    background: value === cw.id ? 'rgba(180,143,255,0.1)' : 'transparent',
                    color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = value === cw.id ? 'rgba(167,139,250,0.1)' : 'transparent' }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-purple)', flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{cw.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{cw.model}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
