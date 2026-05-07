/**
 * InputForm — textarea + submit button for the project description.
 *
 * Props:
 *   onSubmit(description: string) — called when the user submits
 *   isRunning — disables the form while the pipeline is active
 */

import { useEffect, useRef, useState } from 'react'

const PLACEHOLDER = `Describe your software project…

Example: "A SaaS platform for independent personal trainers to manage clients,
schedule sessions, track workout programs, and process payments.
Mobile-friendly with a simple onboarding flow."`

export function InputForm({ onSubmit, isRunning, initialValue = '' }) {
  const [value, setValue] = useState(initialValue)
  const textareaRef = useRef(null)

  // Sync when parent restores a history item
  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || isRunning) return
    onSubmit(trimmed)
  }

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSubmit(e)
    }
  }

  const charCount = value.length
  const isValid = charCount >= 10

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Textarea */}
      <div style={{ position: 'relative' }}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDER}
          disabled={isRunning}
          rows={7}
          style={{
            width: '100%',
            background: 'var(--bg-secondary)',
            border: `1px solid ${isRunning ? 'var(--border)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            lineHeight: '1.65',
            padding: '14px 16px',
            resize: 'vertical',
            outline: 'none',
            transition: 'border-color 200ms',
            fontFamily: 'inherit',
            opacity: isRunning ? 0.5 : 1,
          }}
          onFocus={(e) => {
            if (!isRunning) e.target.style.borderColor = 'rgba(108,99,255,0.4)'
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'rgba(255,255,255,0.1)'
          }}
        />
        {/* Char count */}
        <span
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '12px',
            fontSize: '11px',
            color: charCount > 3800 ? 'var(--error)' : 'var(--text-dim)',
            pointerEvents: 'none',
          }}
        >
          {charCount} / 4000
        </span>
      </div>

      {/* Footer row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>
          {isRunning ? 'Running pipeline…' : '⌘ + Enter to submit'}
        </span>

        <button
          type="submit"
          disabled={!isValid || isRunning}
          style={{
            background:
              !isValid || isRunning
                ? 'rgba(255,255,255,0.06)'
                : 'var(--accent-gradient)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            color: !isValid || isRunning ? 'var(--text-dim)' : '#fff',
            cursor: !isValid || isRunning ? 'not-allowed' : 'pointer',
            fontSize: '13.5px',
            fontWeight: 600,
            padding: '10px 22px',
            transition: 'all 200ms var(--ease-out)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            letterSpacing: '0.01em',
          }}
        >
          {isRunning ? (
            <>
              <span
                className="pulse-dot"
                style={{
                  display: 'inline-block',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: 'var(--accent)',
                }}
              />
              Generating…
            </>
          ) : (
            'Generate Spec →'
          )}
        </button>
      </div>
    </form>
  )
}
