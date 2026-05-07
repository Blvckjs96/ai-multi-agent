/**
 * SpecOutput — renders the final Markdown spec with a copy button.
 *
 * Props:
 *   spec — raw markdown string
 */

import { useState } from 'react'
import Markdown from 'react-markdown'

export function SpecOutput({ spec }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(spec)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable — silently ignore
    }
  }

  return (
    <section
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-accent)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          background: 'rgba(108,99,255,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--accent-gradient)',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--text-primary)',
            }}
          >
            Project Specification
          </span>
        </div>

        <button
          onClick={handleCopy}
          style={{
            background: copied ? 'var(--success-soft)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${copied ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
            color: copied ? 'var(--success)' : 'var(--text-secondary)',
            padding: '5px 14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 200ms var(--ease-out)',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          {copied ? '✓ Copied' : 'Copy Spec'}
        </button>
      </div>

      {/* Markdown body */}
      <div
        className="spec-content"
        style={{
          padding: '20px 24px',
          maxHeight: '600px',
          overflowY: 'auto',
        }}
      >
        <Markdown>{spec}</Markdown>
      </div>
    </section>
  )
}
