import { useEffect, useState } from 'react'

function DiffLine({ line }) {
  if (!line && line !== '') return null

  let color = 'var(--text-dim)'
  let bg = 'transparent'

  if (line.startsWith('+') && !line.startsWith('+++')) {
    color = '#4ade80'
    bg = 'rgba(74,222,128,0.05)'
  } else if (line.startsWith('-') && !line.startsWith('---')) {
    color = '#f87171'
    bg = 'rgba(248,113,113,0.05)'
  } else if (line.startsWith('@@')) {
    color = '#67e8f9'
  } else if (
    line.startsWith('diff ') ||
    line.startsWith('index ') ||
    line.startsWith('---') ||
    line.startsWith('+++')
  ) {
    color = 'var(--text-muted)'
  }

  return (
    <div
      style={{
        background: bg,
        color,
        fontSize: 11,
        fontFamily: 'var(--f-mono, monospace)',
        lineHeight: 1.5,
        padding: '0 12px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}
    >
      {line || ' '}
    </div>
  )
}

export function ConfirmBanner({ onConfirm, onCancel, workspaceId }) {
  const [diffData, setDiffData] = useState(null)
  const [showDiff, setShowDiff] = useState(false)

  useEffect(() => {
    if (!workspaceId) return
    fetch(`/api/v1/workspaces/${workspaceId}/git-diff`)
      .then((r) => r.json())
      .then((d) => { if (d.has_changes) setDiffData(d) })
      .catch(() => {})
  }, [workspaceId])

  const changedFileCount = diffData?.status_output
    ?.trim()
    .split('\n')
    .filter(Boolean).length ?? 0

  const diffLines = diffData?.diff?.split('\n') ?? []
  const hasDiff = Boolean(diffData?.has_changes)

  return (
    <div style={{ margin: '10px 0 6px' }}>
      {/* ── Main banner ── */}
      <div
        style={{
          padding: '16px 20px',
          borderRadius: hasDiff && showDiff ? '14px 14px 0 0' : '14px',
          background: 'rgba(0,212,255,0.05)',
          border: '1px solid rgba(0,212,255,0.3)',
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-start',
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'rgba(0,212,255,0.12)',
            border: '1px solid rgba(0,212,255,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            flexShrink: 0,
            marginTop: '1px',
          }}
        >
          ✦
        </div>

        {/* Copy */}
        <div style={{ flex: 1 }}>
          <p
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: '0 0 3px',
              letterSpacing: '-0.01em',
            }}
          >
            Plan ready — review before executing
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: 0, lineHeight: 1.5 }}>
            Claude will run the steps shown above. Changes to files will take effect immediately.
          </p>
          {hasDiff && (
            <button
              onClick={() => setShowDiff((v) => !v)}
              style={{
                marginTop: 8,
                background: 'transparent',
                border: '1px solid rgba(0,212,255,0.25)',
                borderRadius: 6,
                padding: '3px 10px',
                fontSize: 11,
                color: '#00d4ff',
                cursor: 'pointer',
                transition: 'background 120ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,212,255,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {showDiff ? '▲ Hide' : '▼ View'} uncommitted changes
              {changedFileCount > 0 && ` (${changedFileCount} file${changedFileCount !== 1 ? 's' : ''})`}
            </button>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignSelf: 'center' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '7px 16px',
              borderRadius: '9999px',
              border: '1px solid var(--border-strong)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 150ms',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '7px 20px',
              borderRadius: '9999px',
              border: 'none',
              background: 'linear-gradient(135deg, #00d4ff, #00ff9d)',
              color: '#0a0a0a',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 0 16px rgba(0,212,255,0.25)',
              transition: 'opacity 150ms',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Execute
          </button>
        </div>
      </div>

      {/* ── Expandable diff pane ── */}
      {hasDiff && showDiff && (
        <div
          style={{
            borderRadius: '0 0 14px 14px',
            border: '1px solid rgba(0,212,255,0.3)',
            borderTop: 'none',
            background: 'rgba(0,0,0,0.35)',
            maxHeight: 320,
            overflowY: 'auto',
            padding: '8px 0',
          }}
        >
          {diffLines.map((line, i) => (
            <DiffLine key={i} line={line} />
          ))}
        </div>
      )}
    </div>
  )
}
