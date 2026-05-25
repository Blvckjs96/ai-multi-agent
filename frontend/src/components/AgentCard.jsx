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

function StatusDot({ status }) {
  const map = {
    waiting:  { color: 'var(--text-dim)',       label: 'Waiting'   },
    thinking: { color: 'var(--accent)',          label: 'Thinking'  },
    done:     { color: 'var(--success)',         label: 'Done'      },
  }
  const s = map[status] ?? map.waiting

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        fontSize: '12px',
        color: s.color,
        fontWeight: 500,
      }}
    >
      {status === 'thinking' && (
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
      )}
      {status === 'done' && (
        <span style={{ fontSize: '10px', fontWeight: 700 }}>✓</span>
      )}
      {s.label}
    </span>
  )
}

function PlannerResult({ result }) {
  if (!result?.phases) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {result.phases.map((phase, i) => (
        <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
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
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
              {phase.name}{' '}
              <span style={{ fontSize: '11.5px', fontWeight: 400, color: 'var(--text-dim)' }}>
                · {phase.duration}
              </span>
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
          Tech Stack
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {result.techStack?.map((tech, i) => (
            <span
              key={i}
              style={{
                background: 'var(--bg-hover)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                padding: '2px 9px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              {tech}
            </span>
          ))}
        </div>
      </div>

      <div>
        <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
          Architecture
        </p>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          {result.architecture}
        </p>
      </div>

      {result.keyDecisions?.length > 0 && (
        <div>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
            Key Decisions
          </p>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {result.keyDecisions.map((d, i) => (
              <li key={i} style={{ fontSize: '12.5px', color: 'var(--text-secondary)', display: 'flex', gap: '8px' }}>
                <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '1px' }}>→</span>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', gap: '10px' }}>
        {[
          { label: 'Low estimate',  value: fmt(result.low),  color: 'var(--success)' },
          { label: 'High estimate', value: fmt(result.high), color: 'var(--warning)' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              flex: 1,
              background: 'var(--bg-hover)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>
              {label}
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color }}>
              {value}
            </div>
          </div>
        ))}
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
    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.65 }}>
      {result.preview.slice(0, 220)}…
    </p>
  )
}

const RESULT_COMPONENTS = {
  planner:       PlannerResult,
  engineer:      EngineerResult,
  cost_estimator: CostResult,
  writer:        WriterResult,
}

const PROVIDER_BADGE = {
  anthropic: { label: 'Claude',  color: '#d97706', bg: 'rgba(217,119,6,0.1)'   },
  ollama:    { label: 'Gemma4',  color: '#007aff', bg: 'rgba(0,122,255,0.10)'  },
}

export function AgentCard({ name, status, result, provider }) {
  const meta = AGENT_META[name]
  const ResultComponent = RESULT_COMPONENTS[name]
  const isExpanded = status === 'thinking' || status === 'done'

  const borderColor =
    status === 'thinking' ? 'var(--border-accent)'
    : status === 'done'   ? 'rgba(34,197,94,0.18)'
    :                       'var(--border)'

  return (
    <article
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        transition: `border-color var(--duration-normal) var(--ease-out)`,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '13px 16px',
          borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
        }}
      >
        {/* Icon */}
        <span
          style={{
            width: '30px',
            height: '30px',
            borderRadius: 'var(--radius-sm)',
            background:
              status === 'thinking' ? 'var(--accent-soft)'
              : status === 'done'   ? 'var(--success-soft)'
              :                       'var(--bg-hover)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '13px',
            color:
              status === 'thinking' ? 'var(--accent)'
              : status === 'done'   ? 'var(--success)'
              :                       'var(--text-dim)',
            flexShrink: 0,
            transition: `background var(--duration-normal), color var(--duration-normal)`,
          }}
        >
          {meta.icon}
        </span>

        {/* Label + description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: status === 'waiting' ? 'var(--text-dim)' : 'var(--text-primary)',
              letterSpacing: '-.01em',
              transition: `color var(--duration-normal)`,
            }}
          >
            {meta.label}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '1px' }}>
            {meta.description}
          </div>
        </div>

        {/* Provider badge */}
        {provider && (() => {
          const p = PROVIDER_BADGE[provider] ?? PROVIDER_BADGE.anthropic
          return (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '.05em',
                textTransform: 'uppercase',
                padding: '2px 7px',
                borderRadius: '5px',
                background: p.bg,
                color: p.color,
                flexShrink: 0,
              }}
            >
              {p.label}
            </span>
          )
        })()}

        <StatusDot status={status} />
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div style={{ padding: '14px 16px' }}>
          {status === 'thinking' && !result ? (
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
          ) : (
            result && <ResultComponent result={result} />
          )}
        </div>
      )}
    </article>
  )
}
