import { useState } from 'react'
import { Zap, ChevronDown, ChevronRight, Check, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

const containerStyle = {
  background: 'rgba(0, 212, 255, 0.04)',
  border: '1px solid rgba(0, 212, 255, 0.15)',
  borderRadius: 'var(--r-md)',
  padding: '10px 14px',
  marginTop: 8,
  animation: 'argo-fade-in 250ms ease-out',
}

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginBottom: 8,
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-primary)',
}

const dotStyles = {
  pending: { border: '1.5px solid var(--text-muted)', background: 'transparent' },
  running: { background: 'var(--accent-cyan)', animation: 'argo-dot-pulse 1.2s ease-in-out infinite' },
  done: { background: 'var(--status-success)' },
  error: { background: 'var(--status-error)' },
}

const dotBase = { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }

const StatusIcon = ({ status, duration }) => {
  if (status === 'done') return <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--status-success)' }}><Check size={11} strokeWidth={2.5} />{duration && <span style={{ fontSize: 11 }}>{duration}</span>}</span>
  if (status === 'error') return <X size={11} strokeWidth={2.5} style={{ color: 'var(--status-error)' }} />
  if (status === 'running') return <span style={{ fontSize: 12, fontStyle: 'italic' }}>running…</span>
  return <span style={{ fontSize: 12 }}>—</span>
}

const statusColor = {
  pending: 'var(--text-muted)',
  running: 'var(--accent-cyan)',
  done: 'var(--status-success)',
  error: 'var(--status-error)',
}

function StepRow({ step, expanded, onToggle }) {
  const hasResult = step.status === 'done' && step.result != null
  const nameColor =
    step.status === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)'

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 0',
          cursor: hasResult ? 'pointer' : 'default',
        }}
        onClick={hasResult ? onToggle : undefined}
      >
        <span style={{ ...dotBase, ...dotStyles[step.status] }} />
        <span style={{ fontSize: 12, color: nameColor, flex: 1 }}>{step.name}</span>
        <span style={{ display: 'flex', alignItems: 'center', color: statusColor[step.status] }}>
          <StatusIcon status={step.status} duration={step.duration} />
        </span>
        {hasResult && (
          <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        )}
      </div>
      {expanded && hasResult && (
        <div
          className="spec-content"
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            paddingLeft: 16,
            paddingBottom: 4,
            animation: 'argo-fade-in 200ms ease-out',
          }}
        >
          <ReactMarkdown>{step.result}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}

export default function PipelineProgress({ steps = [] }) {
  const [expandedSet, setExpandedSet] = useState(new Set())

  const allDone = steps.length > 0 && steps.every(s => s.status === 'done' || s.status === 'error')

  function toggleStep(name) {
    setExpandedSet(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <Zap size={13} color="var(--accent-cyan)" />
        {allDone ? 'Pipeline complete' : 'Pipeline running'}
      </div>
      {steps.map(step => (
        <StepRow
          key={step.name}
          step={step}
          expanded={expandedSet.has(step.name)}
          onToggle={() => toggleStep(step.name)}
        />
      ))}
    </div>
  )
}
