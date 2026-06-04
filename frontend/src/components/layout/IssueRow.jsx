import { useState } from 'react'
import { X } from 'lucide-react'

const PRIORITY_DOT = {
  high:   '#ff4d6a',
  medium: '#ffb800',
  low:    '#4a4a55',
}

const STATUS_RING = {
  none:            'transparent',
  starting:        '#ffb800',
  busy:            '#00d4ff',
  awaiting_input:  '#00ff9d',
  stopped:         '#4a4a55',
}

export function IssueRow({ task, isSelected, onClick, onDelete }) {
  const [hover, setHover] = useState(false)

  const dotColor = PRIORITY_DOT[task.priority] || PRIORITY_DOT.low
  const ringColor = STATUS_RING[task.runtime_status] || STATUS_RING.none
  const hasSession = task.runtime_status && task.runtime_status !== 'none'

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 10px',
        borderRadius: 8,
        cursor: 'pointer',
        background: isSelected
          ? 'rgba(0,212,255,0.06)'
          : hover
          ? 'rgba(255,255,255,0.03)'
          : 'transparent',
        borderLeft: isSelected ? '2px solid var(--accent-cyan)' : '2px solid transparent',
        border: 'none',
        outline: 'none',
        transition: 'background 100ms',
        userSelect: 'none',
        position: 'relative',
        width: '100%',
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      {/* Priority dot */}
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
          boxShadow: hasSession ? `0 0 0 2px ${ringColor}` : 'none',
        }}
      />

      {/* Title */}
      <span
        style={{
          fontSize: 12,
          fontWeight: isSelected ? 500 : 400,
          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: 1.4,
        }}
      >
        {task.title}
      </span>

      {/* Session status badge */}
      {hasSession && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: ringColor,
            flexShrink: 0,
          }}
        >
          {task.runtime_status === 'awaiting_input' ? 'waiting' : task.runtime_status}
        </span>
      )}

      {/* Delete on hover */}
      {hover && !isSelected && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete?.(task.id) }}
          title="Delete issue"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 13,
            cursor: 'pointer',
            padding: '0 2px',
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          <X size={11} strokeWidth={2} />
        </button>
      )}
    </button>
  )
}
