import { useState, useEffect, useCallback } from 'react'
import ModelSelector from '../providers/ModelSelector'

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, subtitle, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          {title}
        </h3>
        {subtitle && (
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  )
}

// ── Info row ───────────────────────────────────────────────────────────────────

function InfoRow({ label, value, mono = false, accent = false }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 0',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          fontFamily: mono ? 'var(--f-mono)' : 'var(--f-ui)',
          color: accent ? 'var(--accent-cyan)' : 'var(--text-primary)',
          maxWidth: 260,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value ?? '—'}
      </span>
    </div>
  )
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ ok, labels }) {
  const label = ok ? labels[0] : labels[1]
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: ok ? 'var(--status-success)' : 'var(--status-error)',
        background: ok ? 'rgba(0,255,157,0.08)' : 'rgba(255,77,106,0.08)',
        border: `1px solid ${ok ? 'rgba(0,255,157,0.2)' : 'rgba(255,77,106,0.2)'}`,
        borderRadius: 4,
        padding: '2px 8px',
      }}
    >
      {label}
    </span>
  )
}

// ── Copy button ────────────────────────────────────────────────────────────────

function CopyCmd({ cmd }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '9px 12px',
        background: 'var(--bg-base)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-sm)',
        marginTop: 10,
      }}
    >
      <span className="mono" style={{ flex: 1, fontSize: 12, color: 'var(--text-code)' }}>{cmd}</span>
      <button
        onClick={copy}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: copied ? 'var(--status-success)' : 'var(--text-muted)',
          fontSize: 11,
          fontFamily: 'var(--f-ui)',
          padding: '2px 6px',
          borderRadius: 4,
          transition: 'color 0.15s',
          flexShrink: 0,
        }}
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function SettingsPanel() {
  const [claudeAuth, setClaudeAuth] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginMsg, setLoginMsg] = useState(null)
  const [sysInfo, setSysInfo] = useState(null)

  const fetchAuth = useCallback(async () => {
    setAuthLoading(true)
    try {
      const res = await fetch('/api/v1/settings/claude-auth/status')
      if (res.ok) setClaudeAuth(await res.json())
    } catch { /* silent */ } finally {
      setAuthLoading(false)
    }
  }, [])

  const fetchSys = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/settings/system')
      if (res.ok) setSysInfo(await res.json())
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchAuth()
    fetchSys()
  }, [fetchAuth, fetchSys])

  const handleLogin = async () => {
    setLoginLoading(true)
    setLoginMsg(null)
    try {
      const res = await fetch('/api/v1/settings/claude-auth/login', { method: 'POST' })
      const data = await res.json()
      setLoginMsg(data.ok ? { type: 'success', text: data.message } : { type: 'error', text: data.error })
      if (data.ok) setTimeout(fetchAuth, 4000)
    } catch {
      setLoginMsg({ type: 'error', text: 'Failed to start login flow' })
    } finally {
      setLoginLoading(false)
    }
  }

  const isAuth = claudeAuth?.authenticated
  const isInstalled = claudeAuth?.installed

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-base)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '18px 24px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--f-display)',
            fontWeight: 700,
            fontSize: 16,
            color: 'var(--text-primary)',
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          Settings
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0' }}>
          Argo desktop app configuration
        </p>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

        {/* ── Claude Code CLI ─────────────────────────────────────────── */}
        <Section
          title="Claude Code CLI"
          subtitle="Authentication status for the Claude CLI used by Argo's chat backend"
        >
          {authLoading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '12px 0' }}>Checking…</div>
          ) : (
            <>
              <div
                style={{
                  padding: '14px 16px',
                  background: 'var(--bg-elevated)',
                  border: `1px solid ${isAuth ? 'rgba(0,255,157,0.15)' : isInstalled ? 'rgba(255,183,0,0.15)' : 'rgba(255,77,106,0.15)'}`,
                  borderRadius: 'var(--r-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: isAuth ? 'var(--status-success)' : isInstalled ? 'var(--status-warning)' : 'var(--status-error)',
                        boxShadow: isAuth ? '0 0 6px var(--status-success)' : 'none',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {isAuth ? 'Authenticated' : isInstalled ? 'Not authenticated' : 'CLI not installed'}
                    </span>
                  </div>
                  {claudeAuth?.version && (
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {claudeAuth.version}
                    </span>
                  )}
                  {claudeAuth?.path && (
                    <span className="mono" style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      {claudeAuth.path}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    className="btn btn-ghost"
                    onClick={fetchAuth}
                    style={{ fontSize: 11, padding: '4px 10px' }}
                  >
                    Refresh
                  </button>
                  {!isAuth && isInstalled && (
                    <button
                      className="btn btn-primary"
                      onClick={handleLogin}
                      disabled={loginLoading}
                      style={{ fontSize: 11, padding: '4px 12px' }}
                    >
                      {loginLoading ? 'Opening…' : 'Log in'}
                    </button>
                  )}
                </div>
              </div>

              {loginMsg && (
                <div
                  style={{
                    padding: '8px 12px',
                    background: loginMsg.type === 'success' ? 'rgba(0,255,157,0.06)' : 'rgba(255,77,106,0.06)',
                    border: `1px solid ${loginMsg.type === 'success' ? 'rgba(0,255,157,0.2)' : 'rgba(255,77,106,0.2)'}`,
                    borderRadius: 'var(--r-sm)',
                    fontSize: 12,
                    color: loginMsg.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
                    marginBottom: 12,
                  }}
                >
                  {loginMsg.text}
                </div>
              )}

              {!isInstalled && (
                <>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 6px' }}>
                    Install Claude Code CLI:
                  </p>
                  <CopyCmd cmd="npm install -g @anthropic-ai/claude-code" />
                </>
              )}

              {isInstalled && !isAuth && (
                <>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '8px 0 6px' }}>
                    Or run manually in your terminal:
                  </p>
                  <CopyCmd cmd="claude auth login" />
                </>
              )}
            </>
          )}
        </Section>

        {/* ── Active Claude Model ──────────────────────────────────────── */}
        <Section
          title="Active Claude Model"
          subtitle="Controls which model the Chat and Pipeline panels use"
        >
          <ModelSelector compact={false} />
        </Section>

        {/* ── System info ─────────────────────────────────────────────── */}
        {sysInfo && (
          <Section title="System" subtitle="Runtime environment details">
            <InfoRow label="Platform" value={`${sysInfo.platform} ${sysInfo.machine}`} />
            <InfoRow label="Python" value={sysInfo.python_version} mono />
            {sysInfo.claude_dir && (
              <InfoRow label="Claude config dir" value={sysInfo.claude_dir} mono />
            )}
          </Section>
        )}

        {/* ── About ────────────────────────────────────────────────────── */}
        <Section title="About">
          <InfoRow label="App" value="Argo" />
          <InfoRow label="Backend" value="FastAPI + PydanticAI" />
          <InfoRow label="Chat" value="Claude Code CLI (SSE streaming)" />
        </Section>
      </div>
    </div>
  )
}
