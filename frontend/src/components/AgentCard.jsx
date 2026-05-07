/**
 * AgentCard — displays one agent's status and result in the pipeline.
 *
 * Props:
 *   name    — agent identifier: 'planner' | 'engineer' | 'cost_estimator' | 'writer'
 *   status  — 'waiting' | 'thinking' | 'done'
 *   result  — structured object from the agent (null when waiting/thinking)
 */

const AGENT_META = {
  planner: {
    label: 'Planner',
    description: 'Breaks the project into concrete phases',
    icon: '◎',
  },
  engineer: {
    label: 'Engineer',
    description: 'Designs the technical architecture',
    icon: '⬡',
  },
  cost_estimator: {
    label: 'Cost Estimator',
    description: 'Calculates realistic US freelance rates',
    icon: '◈',
  },
  writer: {
    label: 'Writer',
    description: 'Assembles the final specification document',
    icon: '◻',
  },
}

function StatusBadge({ status }) {
  const styles = {
    waiting: {
      bg: 'rgba(255,255,255,0.04)',
      color: 'var(--text-dim)',
      label: 'Waiting',
    },
    thinking: {
      bg: 'var(--accent-soft)',
      color: 'var(--accent)',
      label: 'Thinking',
    },
    done: {
      bg: 'var(--success-soft)',
      color: 'var(--success)',
      label: 'Done',
    },
  }

  const s = styles[status]

  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        padding: '2px 10px',
        borderRadius: '99px',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
      }}
    >
      {status === 'thinking' && (
        <span
          className="pulse-dot"
          style={{
            display: 'inline-block',
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            background: 'var(--accent)',
          }}
        />
      )}
      {status === 'done' && <span style={{ fontSize: '9px' }}>✓</span>}
      {s.label}
    </span>
  )
}

function PlannerResult({ result }) {
  if (!result?.phases) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {result.phases.map((phase, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
          }}
        >
          <span
            style={{
              minWidth: '20px',
              height: '20px',
              borderRadius: '50%',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              fontSize: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: '1px',
              flexShrink: 0,
            }}
          >
            {i + 1}
          </span>
          <div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '2px',
              }}
            >
              {phase.name}{' '}
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 400,
                  color: 'var(--text-dim)',
                }}
              >
                · {phase.duration}
              </span>
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              {phase.goal}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function EngineerResult({ result }) {
  if (!result) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-dim)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: '6px',
          }}
        >
          Tech Stack
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {result.techStack?.map((tech, i) => (
            <span
              key={i}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11.5px',
                fontFamily: 'monospace',
              }}
            >
              {tech}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-dim)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: '6px',
          }}
        >
          Architecture
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          {result.architecture}
        </p>
      </div>
      {result.keyDecisions?.length > 0 && (
        <div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-dim)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}
          >
            Key Decisions
          </div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {result.keyDecisions.map((d, i) => (
              <li
                key={i}
                style={{ fontSize: '12.5px', color: 'var(--text-secondary)', display: 'flex', gap: '8px' }}
              >
                <span style={{ color: 'var(--accent)', flexShrink: 0 }}>→</span>
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function CostResult({ result }) {
  if (!result) return null
  const fmt = (n) => `$${n.toLocaleString('en-US')}`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '16px' }}>
        <div
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
          }}
        >
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
            Low
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>
            {fmt(result.low)}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
          }}
        >
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
            High
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--warning)' }}>
            {fmt(result.high)}
          </div>
        </div>
      </div>
      <div>
        {result.breakdown?.map((item, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '7px 0',
              borderBottom: i < result.breakdown.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{item.item}</span>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(item.cost)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function WriterResult({ result }) {
  if (!result?.preview) return null
  return (
    <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.6 }}>
      {result.preview.slice(0, 200)}…
    </p>
  )
}

const RESULT_COMPONENTS = {
  planner: PlannerResult,
  engineer: EngineerResult,
  cost_estimator: CostResult,
  writer: WriterResult,
}

const PROVIDER_BADGE = {
  anthropic: { label: 'Claude', color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
  ollama:    { label: 'Gemma4', color: '#00d4ff', bg: 'rgba(0,212,255,0.1)' },
}

export function AgentCard({ name, status, result, provider }) {
  const meta = AGENT_META[name]
  const ResultComponent = RESULT_COMPONENTS[name]
  const isExpanded = status === 'thinking' || status === 'done'

  return (
    <article
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${
          status === 'thinking'
            ? 'var(--border-accent)'
            : status === 'done'
              ? 'rgba(34,197,94,0.15)'
              : 'var(--border)'
        }`,
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        transition: `border-color ${300}ms var(--ease-out)`,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 18px',
          borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
        }}
      >
        <span
          style={{
            width: '32px',
            height: '32px',
            borderRadius: 'var(--radius-sm)',
            background:
              status === 'thinking'
                ? 'var(--accent-soft)'
                : status === 'done'
                  ? 'var(--success-soft)'
                  : 'rgba(255,255,255,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            color:
              status === 'thinking'
                ? 'var(--accent)'
                : status === 'done'
                  ? 'var(--success)'
                  : 'var(--text-dim)',
            transition: `background ${300}ms var(--ease-out), color ${300}ms var(--ease-out)`,
          }}
        >
          {meta.icon}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: status === 'waiting' ? 'var(--text-dim)' : 'var(--text-primary)',
              transition: `color ${300}ms`,
            }}
          >
            {meta.label}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '1px' }}>
            {meta.description}
          </div>
        </div>

        {provider && (() => {
          const p = PROVIDER_BADGE[provider] ?? PROVIDER_BADGE.anthropic
          return (
            <span style={{
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '2px 7px',
              borderRadius: '4px',
              background: p.bg,
              color: p.color,
              flexShrink: 0,
            }}>
              {p.label}
            </span>
          )
        })()}
        <StatusBadge status={status} />
      </div>

      {/* Body — only show when active or done */}
      {isExpanded && (
        <div style={{ padding: '16px 18px' }}>
          {status === 'thinking' && !result && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dim)', fontSize: '12.5px' }}>
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
              Processing…
            </div>
          )}
          {result && <ResultComponent result={result} />}
        </div>
      )}
    </article>
  )
}
