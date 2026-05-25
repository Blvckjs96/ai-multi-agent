import { useEffect, useRef, useState } from 'react'

const PLACEHOLDER = `Describe your software project…

Example: "A SaaS platform for independent personal trainers to manage clients, schedule sessions, track workout programs, and process payments. Mobile-friendly with a simple onboarding flow."`

export function InputForm({ onSubmit, isRunning, initialValue = '' }) {
  const [value, setValue] = useState(initialValue)
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef(null)

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
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit(e)
  }

  const charCount = value.length
  const isValid = charCount >= 10

  const borderColor = focused
    ? 'rgba(0, 122, 255, 0.5)'
    : 'var(--border-strong)'

  return (
    <form onSubmit={handleSubmit}>
      {/* Pill container */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: `1px solid ${borderColor}`,
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          transition: `border-color var(--duration-fast)`,
          opacity: isRunning ? 0.6 : 1,
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={PLACEHOLDER}
          disabled={isRunning}
          rows={6}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: '14px',
            lineHeight: '1.65',
            padding: '18px 20px 10px',
            resize: 'none',
            fontFamily: 'var(--font-sans)',
          }}
        />

        {/* Bottom action bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px 14px',
          }}
        >
          <span
            style={{
              fontSize: '12px',
              color: charCount > 3800 ? 'var(--error)' : 'var(--text-dim)',
            }}
          >
            {isRunning ? 'Running pipeline…' : charCount > 0 ? `${charCount} / 4000` : '⌘ Enter to submit'}
          </span>

          <button
            type="submit"
            disabled={!isValid || isRunning}
            style={{
              background: !isValid || isRunning ? 'var(--bg-hover)' : 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              color: !isValid || isRunning ? 'var(--text-dim)' : '#fff',
              cursor: !isValid || isRunning ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              padding: '8px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              transition: `background var(--duration-fast), color var(--duration-fast)`,
              letterSpacing: '-.01em',
            }}
          >
            {isRunning ? (
              <>
                <span
                  className="pulse-dot"
                  style={{
                    display: 'inline-block',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--accent)',
                  }}
                />
                Generating
              </>
            ) : (
              'Generate →'
            )}
          </button>
        </div>
      </div>
    </form>
  )
}
