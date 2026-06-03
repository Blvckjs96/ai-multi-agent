import { useState } from 'react'
import { apiFetch } from '../../lib/api'

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const body = new URLSearchParams({ username: email, password })
      const res = await apiFetch('/api/v1/auth/login', { method: 'POST', body })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.detail || data?.error?.message || `HTTP ${res.status}`)
      }
      const { access_token } = await res.json()
      localStorage.setItem('token', access_token)
      onLogin()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100dvh', background: 'var(--bg-base)',
    }}>
      <form onSubmit={submit} noValidate style={{
        width: 320, display: 'flex', flexDirection: 'column', gap: 16,
        padding: '36px 32px', background: 'var(--bg-surface)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
      }}>
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Argo</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>Sign in to continue</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Email</label>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            required autoFocus
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '8px 12px',
              fontSize: 13, color: 'var(--text-primary)', 
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Password</label>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '8px 12px',
              fontSize: 13, color: 'var(--text-primary)', 
              fontFamily: 'inherit',
            }}
          />
        </div>

        {error && (
          <div style={{
            padding: '8px 12px', background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)',
            fontSize: 12, color: 'var(--error)',
          }}>{error}</div>
        )}

        <button
          type="submit" disabled={loading}
          style={{
            background: 'var(--accent-grad)', color: '#000', fontWeight: 700,
            fontSize: 13, padding: '9px 0', borderRadius: 'var(--radius-sm)',
            border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1, fontFamily: 'inherit',
          }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
