import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

// xterm.js — loaded dynamically so Vite doesn't choke during SSR/test runs
let Terminal = null
let FitAddon = null

async function loadXterm() {
  if (Terminal) return
  const [xterm, fit] = await Promise.all([
    import('@xterm/xterm'),
    import('@xterm/addon-fit'),
  ])
  Terminal = xterm.Terminal
  FitAddon = fit.FitAddon
}

const XTERM_THEME = {
  background:   '#0a0a0b',
  foreground:   '#e2e2e7',
  cursor:       '#00d4ff',
  cursorAccent: '#001218',
  black:        '#1a1a1f',
  brightBlack:  '#3a3a45',
  red:          '#ff4d6a',
  brightRed:    '#ff6b85',
  green:        '#00ff9d',
  brightGreen:  '#33ffb3',
  yellow:       '#ffd166',
  brightYellow: '#ffe08a',
  blue:         '#00d4ff',
  brightBlue:   '#33ddff',
  magenta:      '#b48fff',
  brightMagenta:'#c9aaff',
  cyan:         '#00e5cc',
  brightCyan:   '#33ebda',
  white:        '#c8c8d4',
  brightWhite:  '#e2e2ed',
}

// Claude CLI flags — autonomous agent mode
const CLAUDE_ARGS = ['--dangerously-skip-permissions', '--model', 'claude-opus-4-7']
const CLAUDE_ENV  = {
  // Proper terminal capabilities so Claude renders colours / styling correctly
  TERM:                          'xterm-256color',
  COLORTERM:                     'truecolor',
  TERM_PROGRAM:                  'Argo',
  ARGO_TERMINAL:                 '1',
  // Claude CLI cosmetic flags
  CLAUDE_CODE_HIDE_ACCOUNT_INFO: '1',
  CLAUDE_CODE_NO_FLICKER:        '1',
  CLAUDE_CODE_SCROLL_SPEED:      '3',
}

function genId() {
  return crypto.randomUUID ? crypto.randomUUID() : `pty-${Date.now()}`
}

// ── StatusDot ─────────────────────────────────────────────────────────────────

function StatusDot({ status }) {
  const colors = {
    spawning:  'var(--accent-cyan)',
    running:   'var(--accent-cyan)',
    awaiting:  'var(--accent-green)',
    busy:      '#ffd166',
    exited:    'var(--text-muted)',
    error:     'var(--status-error)',
  }
  const glow = new Set(['running', 'awaiting', 'busy'])
  const color = colors[status] ?? 'var(--text-muted)'
  return (
    <span style={{
      width: 7, height: 7, borderRadius: '50%',
      background: color, display: 'inline-block', flexShrink: 0,
      boxShadow: glow.has(status) ? `0 0 6px ${color}` : 'none',
    }} />
  )
}

// ── TerminalTab ───────────────────────────────────────────────────────────────

export function TerminalTab({ taskId, task, cwd: cwdProp, worktreePath, workspacePath, onStatusChange }) {
  const containerRef         = useRef(null)
  const termRef              = useRef(null)   // xterm Terminal instance
  const fitRef               = useRef(null)   // FitAddon instance
  const sessionIdRef         = useRef(null)
  const unlistenRef          = useRef(null)   // cleanup for pty-output listener
  const unlistenExRef        = useRef(null)   // cleanup for pty-exit listener
  const initialPromptSentRef = useRef(false)  // guard: only inject task prompt once per tab

  const [status, setStatus]   = useState('idle')   // idle | spawning | running | awaiting | busy | exited | error
  const [errMsg, setErrMsg]   = useState('')
  const [claudePath, setClaudePath] = useState(null)
  const [cwd, setCwd]         = useState(cwdProp ?? null)

  useEffect(() => {
    onStatusChange?.(status)
  }, [status, onStatusChange])

  // ── Terminal lifecycle ────────────────────────────────────────────────────

  const spawnSession = useCallback(async (path) => {
    if (!path) { setStatus('error'); setErrMsg('claude binary not found'); return }
    if (!containerRef.current) return

    // Kill previous session if any
    if (sessionIdRef.current) {
      invoke('pty_kill', { id: sessionIdRef.current }).catch(() => {})
      unlistenRef.current?.()
      unlistenExRef.current?.()
    }

    await loadXterm()

    // Destroy previous terminal DOM instance
    if (termRef.current) {
      termRef.current.dispose()
      termRef.current = null
    }

    const id = genId()
    sessionIdRef.current = id

    const term = new Terminal({
      fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.35,
      cursorBlink: true,
      scrollback: 5000,
      theme: XTERM_THEME,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)
    // Wait for the browser to complete CSS layout before measuring the
    // container — two RAFs ensure the flex box has settled its final size.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    fit.fit()
    termRef.current = term
    fitRef.current  = fit

    // OSC 633 — VS Code shell-integration protocol.
    // Claude's sub-shell emits these when shell integration is active, allowing
    // us to track whether the session is at a prompt (awaiting) or running a
    // command (busy) without polling.
    term.parser.registerOscHandler(633, (data) => {
      if (data === 'A') {
        setStatus('awaiting')              // prompt painted — waiting for input
      } else if (data === 'C') {
        setStatus('busy')                  // command started
      } else if (data.startsWith('D;') || data === 'D') {
        setStatus('awaiting')              // command finished, back at prompt
      } else if (data.startsWith('P;Cwd=')) {
        setCwd(data.slice(6))              // working-directory update
      }
      return true                          // consume — don't let xterm render it
    })

    // Forward user keystrokes → PTY
    term.onData((data) => {
      if (sessionIdRef.current) {
        invoke('pty_write', { id: sessionIdRef.current, data }).catch(() => {})
      }
    })

    setStatus('spawning')
    setErrMsg('')
    setCwd(cwdProp ?? null)

    // Listen for PTY output events
    unlistenRef.current = await listen('pty-output', (event) => {
      if (event.payload.id === id) {
        term.write(event.payload.data)
      }
    })

    // Listen for PTY exit — cleanup worktree if one was created
    unlistenExRef.current = await listen('pty-exit', (event) => {
      if (event.payload.id !== id) return
      setStatus('exited')
      term.writeln('\r\n\x1b[2m[session ended]\x1b[0m')
      if (worktreePath && workspacePath) {
        invoke('git_worktree_remove', { cwd: workspacePath, path: worktreePath, force: false })
          .catch(() => {}) // non-fatal: may already be removed
      }
    })

    const { cols, rows } = fit.proposeDimensions() ?? { cols: 80, rows: 24 }

    try {
      await invoke('pty_spawn', {
        id,
        cmd: path,
        args: CLAUDE_ARGS,
        env: CLAUDE_ENV,
        ...(cwdProp ? { cwd: cwdProp } : {}),
        cols: Math.max(cols, 20),
        rows: Math.max(rows, 5),
      })
      setStatus('running')
      term.focus()

      // Auto-inject task description on first spawn only (not on "New session")
      if (task?.title && !initialPromptSentRef.current) {
        initialPromptSentRef.current = true
        const prompt = [task.title, task.description].filter(Boolean).join('\n\n')
        setTimeout(() => {
          if (sessionIdRef.current === id) {
            invoke('pty_write', { id, data: prompt + '\n' }).catch(() => {})
          }
        }, 1200)
      }
    } catch (err) {
      setStatus('error')
      setErrMsg(String(err))
      term.writeln(`\r\n\x1b[31mFailed to start Claude CLI:\x1b[0m ${err}`)
    }
  }, [cwdProp, task])

  // ── Mount: find claude binary, spawn first session ────────────────────────

  useEffect(() => {
    let mounted = true

    invoke('find_claude_path').then((path) => {
      if (!mounted) return
      setClaudePath(path)
      if (path) spawnSession(path)
      else { setStatus('error'); setErrMsg('claude not found in PATH') }
    }).catch(() => {
      if (!mounted) return
      setStatus('error')
      setErrMsg('Failed to locate claude binary')
    })

    return () => { mounted = false }
  }, [spawnSession])

  // ── Resize observer → tell PTY about new dimensions ──────────────────────

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(() => {
      if (!fitRef.current || !sessionIdRef.current) return
      fitRef.current.fit()
      const { cols, rows } = fitRef.current.proposeDimensions() ?? {}
      if (cols && rows) {
        invoke('pty_resize', { id: sessionIdRef.current, cols, rows }).catch(() => {})
      }
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // ── Unmount cleanup ───────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      unlistenRef.current?.()
      unlistenExRef.current?.()
      if (sessionIdRef.current) {
        invoke('pty_kill', { id: sessionIdRef.current }).catch(() => {})
      }
      termRef.current?.dispose()
    }
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', background: '#0a0a0b' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '6px 14px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        flexShrink: 0,
      }}>
        <StatusDot status={status} />

        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
          Claude CLI
        </span>

        {sessionIdRef.current && (
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {sessionIdRef.current.slice(0, 8)}
          </span>
        )}

        <span style={{
          fontSize: 10, padding: '1px 8px', borderRadius: 999,
          background: 'rgba(0,212,255,0.08)', color: 'var(--accent-cyan)',
          border: '1px solid rgba(0,212,255,0.18)',
          fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {status}
        </span>

        {errMsg && (
          <span style={{ fontSize: 11, color: 'var(--status-error)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {errMsg}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* CWD badge — appears when shell integration reports it */}
        {cwd && (
          <span className="mono" style={{
            fontSize: 10, color: 'var(--text-muted)',
            maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            direction: 'rtl', textAlign: 'right',
          }} title={cwd}>
            {cwd}
          </span>
        )}

        {/* Model pill */}
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--f-mono)', flexShrink: 0 }}>
          opus-4-7 · auto
        </span>

        {/* New session button */}
        <button
          onClick={() => spawnSession(claudePath)}
          disabled={status === 'spawning'}
          title="New session"
          style={{
            background: 'transparent', border: '1px solid var(--border-active)',
            color: 'var(--text-secondary)', padding: '3px 10px',
            borderRadius: 'var(--r-sm)', fontSize: 11, cursor: 'pointer',
            opacity: status === 'spawning' ? 0.4 : 1,
          }}
        >
          + New
        </button>
      </div>

      {/* xterm.js mount point */}
      <div
        ref={containerRef}
        style={{ flex: 1, overflow: 'hidden', padding: '4px 0 0 4px' }}
      />
    </div>
  )
}
