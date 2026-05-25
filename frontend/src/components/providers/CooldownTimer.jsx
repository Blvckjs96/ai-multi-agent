import { useState, useEffect } from 'react'

export default function CooldownTimer({ seconds }) {
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => {
    setRemaining(seconds)
    if (seconds <= 0) return
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval)
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [seconds])

  if (remaining <= 0) return null

  const display =
    remaining < 60
      ? `${remaining}s`
      : remaining < 3600
        ? `${Math.floor(remaining / 60)}m ${remaining % 60}s`
        : `${Math.floor(remaining / 3600)}h ${Math.floor((remaining % 3600) / 60)}m`

  return (
    <span
      style={{
        fontFamily: 'var(--f-mono)',
        fontSize: '11px',
        color: 'var(--status-warning)',
        background: 'rgba(255,184,0,0.08)',
        border: '1px solid rgba(255,184,0,0.2)',
        borderRadius: 'var(--r-sm)',
        padding: '2px 6px',
      }}
    >
      ⏱ {display}
    </span>
  )
}
