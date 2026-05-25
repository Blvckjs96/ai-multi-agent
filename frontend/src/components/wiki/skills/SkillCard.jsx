import { Wrench, CheckCircle2, Loader2, AlertCircle, Clock } from 'lucide-react'

const STATUS_META = {
  active:      { color: 'var(--success)',    Icon: CheckCircle2, label: 'Active' },
  processing:  { color: 'var(--accent)',     Icon: Loader2,      label: 'Processing' },
  error:       { color: 'var(--error)',      Icon: AlertCircle,  label: 'Failed' },
  pending:     { color: 'var(--text-dim)',   Icon: Clock,        label: 'Pending' },
}

const s = {
  card: {
    padding: '14px 16px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)', background: 'var(--bg-elevated)',
    transition: 'border-color 150ms, box-shadow 150ms', cursor: 'pointer',
  },
  header: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' },
  icon: { fontSize: '22px' },
  title: { fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', flex: 1 },
  status: {
    display: 'flex', alignItems: 'center', gap: '4px',
    fontSize: '11px', fontWeight: 600,
  },
  version: {
    fontSize: '10px', background: 'var(--bg-overlay)', border: '1px solid var(--border)',
    borderRadius: '4px', padding: '1px 6px', color: 'var(--text-dim)',
  },
  description: { fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 },
  tags: { display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' },
  tag: {
    fontSize: '10px', background: 'var(--accent-soft)', color: 'var(--accent)',
    borderRadius: '4px', padding: '1px 6px', fontWeight: 600,
  },
}

export default function SkillCard({ skill, onClick }) {
  const meta = STATUS_META[skill.status] || STATUS_META.pending
  const { Icon: StatusIcon } = meta

  return (
    <div
      style={s.card}
      onClick={() => onClick?.(skill)}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-strong)'
        e.currentTarget.style.boxShadow = 'var(--sh-2)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={s.header}>
        <Wrench size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span style={s.title}>{skill.name || skill.slug}</span>
        {skill.current_version && (
          <span style={s.version}>v{skill.current_version}</span>
        )}
        <span style={{ ...s.status, color: meta.color }}>
          <StatusIcon size={11} /> {meta.label}
        </span>
      </div>
      {skill.description && (
        <div style={s.description}>{skill.description.slice(0, 140)}{skill.description.length > 140 ? '…' : ''}</div>
      )}
      {skill.tags?.length > 0 && (
        <div style={s.tags}>
          {skill.tags.slice(0, 5).map((t) => <span key={t} style={s.tag}>{t}</span>)}
        </div>
      )}
    </div>
  )
}
