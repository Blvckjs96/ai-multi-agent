/**
 * ViewToggle — switches between Chat (bubbles) and Terminal (raw events) view.
 */

export function ViewToggle({ view, onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '9999px',
        padding: '2px',
        gap: '2px',
      }}
      role="tablist"
      aria-label="View mode"
    >
      {['chat', 'terminal'].map((v) => (
        <button
          key={v}
          role="tab"
          aria-selected={view === v}
          onClick={() => onChange(v)}
          style={{
            padding: '4px 14px',
            borderRadius: '9999px',
            border: 'none',
            background: view === v ? 'var(--border-strong)' : 'transparent',
            color: view === v ? 'var(--text-primary)' : 'var(--text-dim)',
            fontSize: '12px',
            fontWeight: view === v ? 600 : 400,
            cursor: 'pointer',
            transition: 'background 150ms, color 150ms',
            letterSpacing: '-.01em',
          }}
        >
          {v === 'chat' ? '💬 Chat' : '⌨ Terminal'}
        </button>
      ))}
    </div>
  )
}
