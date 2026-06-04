import CooldownTimer from './CooldownTimer'

export default function ModelHealthRow({ modelKey, health, label }) {
  const isLocked = health?.tech_locked
  const isDeprioritized = health?.quality_deprioritized
  const errorRate =
    health?.total_calls > 0 ? Math.round((health.total_errors / health.total_calls) * 100) : 0

  let statusColor = 'var(--status-success)'
  let statusLabel = 'Healthy'
  if (isLocked) {
    statusColor = 'var(--status-error)'
    statusLabel = 'Locked'
  } else if (isDeprioritized) {
    statusColor = 'var(--status-warning)'
    statusLabel = 'Degraded'
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 'var(--r-sm)',
        background: isLocked ? 'rgba(255,77,106,0.05)' : 'transparent',
        border: `1px solid ${isLocked ? 'rgba(255,77,106,0.15)' : 'var(--border)'}`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: statusColor,
          flexShrink: 0,
          boxShadow: `0 0 6px ${statusColor}`,
        }}
      />

      <span
        style={{
          fontFamily: 'var(--f-mono)',
          fontSize: '11px',
          color: 'var(--text-secondary)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label || modelKey.split('/').slice(1).join('/')}
      </span>

      {health?.total_calls > 0 && (
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--f-mono)' }}>
          {health.total_calls} calls · {errorRate}% err
        </span>
      )}

      <span
        style={{
          fontSize: '10px',
          fontFamily: 'var(--f-mono)',
          color: statusColor,
          background: `${statusColor}12`,
          border: `1px solid ${statusColor}30`,
          borderRadius: 4,
          padding: '1px 5px',
          flexShrink: 0,
        }}
      >
        {statusLabel}
      </span>

      {isLocked && health.tech_locked_until_secs > 0 && (
        <CooldownTimer seconds={Math.ceil(health.tech_locked_until_secs)} />
      )}

      {health?.quality_fail_streak > 0 && !isLocked && (
        <span style={{ fontSize: '10px', color: 'var(--status-warning)', fontFamily: 'var(--f-mono)' }}>
          ⚠ {health.quality_fail_streak} quality fails
        </span>
      )}
    </div>
  )
}
