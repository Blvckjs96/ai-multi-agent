import { useState } from 'react'
import { Check } from 'lucide-react'
import Markdown from 'react-markdown'

export function SpecOutput({ spec }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(spec)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable
    }
  }

  return (
    <section
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-accent)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'rgba(0,122,255,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: 'var(--accent)',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '.05em',
              textTransform: 'uppercase',
            }}
          >
            Project Specification
          </span>
        </div>

        <button
          onClick={handleCopy}
          style={{
            background: copied ? 'var(--success-soft)' : 'transparent',
            border: `1px solid ${copied ? 'rgba(34,197,94,0.22)' : 'var(--border-strong)'}`,
            color: copied ? 'var(--success)' : 'var(--text-secondary)',
            padding: '5px 14px',
            borderRadius: 'var(--radius-lg)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: `all var(--duration-fast)`,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
          onMouseEnter={(e) => {
            if (!copied) e.currentTarget.style.background = 'var(--bg-hover)'
          }}
          onMouseLeave={(e) => {
            if (!copied) e.currentTarget.style.background = 'transparent'
          }}
        >
          {copied ? <><Check size={11} style={{ verticalAlign: 'middle' }} /> Copied</> : 'Copy'}
        </button>
      </div>

      {/* Markdown body */}
      <div
        className="spec-content"
        style={{ padding: '20px 24px', maxHeight: '600px', overflowY: 'auto' }}
      >
        <Markdown>{spec}</Markdown>
      </div>
    </section>
  )
}
