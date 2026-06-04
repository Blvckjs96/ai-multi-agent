import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from '../../lib/api'

const POLL_INTERVAL = 30_000

export default function ClaudeAuthStatus() {
  const [auth, setAuth] = useState(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const timerRef = useRef(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/settings/claude-auth/status')
      if (res.ok) setAuth(await res.json())
    } catch { /* network not ready yet */ }
  }, [])

  useEffect(() => {
    fetchStatus()
    timerRef.current = setInterval(fetchStatus, POLL_INTERVAL)
    return () => clearInterval(timerRef.current)
  }, [fetchStatus])

  const handleLogin = async () => {
    setLoading(true)
    setMsg(null)
    try {
      const res = await apiFetch('/api/v1/settings/claude-auth/login', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setMsg({ type: 'info', text: 'Check your browser…' })
        // Re-poll faster after initiating login
        setTimeout(fetchStatus, 5000)
        setTimeout(fetchStatus, 12000)
      } else {
        setMsg({ type: 'error', text: data.error ?? 'Login failed' })
      }
    } catch {
      setMsg({ type: 'error', text: 'Request failed' })
    } finally {
      setLoading(false)
    }
  }

  const clearMsg = () => setMsg(null)

  if (!auth) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block' }} />
        <span style={{ color: 'var(--text-muted)' }}>Claude CLI</span>
      </span>
    )
  }

  if (auth.authenticated) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span
          className="pulse-dot"
          style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-success)', boxShadow: '0 0 5px var(--status-success)', display: 'inline-block' }}
        />
        <span>Claude CLI</span>
      </span>
    )
  }

  // Not authenticated — show sign-in affordance
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-warning, #ffb700)', display: 'inline-block', flexShrink: 0 }}
      />

      {msg ? (
        <span
          onClick={clearMsg}
          style={{
            fontSize: 11,
            color: msg.type === 'error' ? 'var(--status-error)' : 'var(--accent-cyan)',
            cursor: 'pointer',
            maxWidth: 180,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title="Click to dismiss"
        >
          {msg.text}
        </span>
      ) : (
        <button
          onClick={handleLogin}
          disabled={loading}
          title={auth.installed ? 'Sign in to Claude Code via browser OAuth' : 'Claude CLI not installed'}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: auth.installed ? 'pointer' : 'default',
            fontFamily: 'var(--f-ui)',
            fontSize: 11,
            color: auth.installed ? 'var(--accent-cyan)' : 'var(--text-muted)',
            textDecoration: auth.installed ? 'underline' : 'none',
            textUnderlineOffset: 2,
            opacity: loading ? 0.6 : 1,
            transition: 'opacity 0.15s',
            letterSpacing: 'inherit',
          }}
        >
          {loading ? 'Opening…' : auth.installed ? 'Sign in to Claude' : 'CLI not installed'}
        </button>
      )}
    </span>
  )
}
