import { File, FileText, FileType2, Image, CheckCircle2, Loader2, ClipboardList, AlertCircle, Clock, Trash2, RotateCcw } from 'lucide-react'

const STATUS_META = {
  pending:        { color: 'var(--text-dim)',    Icon: Clock,          label: 'Pending' },
  processing:     { color: 'var(--accent-cyan)', Icon: Loader2,        label: 'Processing' },
  plan_ready:     { color: 'var(--warning)',     Icon: ClipboardList,  label: 'Review plan' },
  completed:      { color: 'var(--success)',     Icon: CheckCircle2,   label: 'Compiled' },
  error:          { color: 'var(--error)',       Icon: AlertCircle,    label: 'Failed' },
}

const s = {
  card: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '10px 14px', borderBottom: '1px solid var(--border)',
    transition: 'background 100ms',
  },
  icon: { fontSize: '18px', flexShrink: 0 },
  main: { flex: 1, minWidth: 0 },
  name: {
    fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  meta: { fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' },
  status: {
    display: 'flex', alignItems: 'center', gap: '5px',
    fontSize: '11px', fontWeight: 600, flexShrink: 0,
  },
  progress: {
    height: '3px', background: 'var(--bg-overlay)', borderRadius: '2px',
    marginTop: '4px', overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: '2px',
    background: 'var(--accent-grad)', transition: 'width 300ms',
  },
  actions: { display: 'flex', gap: '6px', flexShrink: 0 },
  btn: {
    fontSize: '11px', padding: '3px 8px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)', background: 'transparent',
    cursor: 'pointer', transition: 'border-color 150ms, color 150ms',
    color: 'var(--text-secondary)',
  },
}

function FileIcon({ name }) {
  const ext = name?.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return <FileType2 size={18} style={{ color: 'var(--error)' }} />
  if (['md', 'mdx'].includes(ext)) return <FileText size={18} style={{ color: 'var(--accent-cyan)' }} />
  if (['doc', 'docx'].includes(ext)) return <FileText size={18} style={{ color: '#5b8fff' }} />
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return <Image size={18} style={{ color: 'var(--text-secondary)' }} />
  return <File size={18} style={{ color: 'var(--text-dim)' }} />
}

export default function SourceCard({ source, onRetry, onReviewPlan, onDelete }) {
  const meta = STATUS_META[source.status] || STATUS_META.pending
  const { Icon: StatusIcon } = meta
  const isProcessing = source.status === 'processing'
  const progress = source.progress || 0
  const size = source.file_size
    ? source.file_size < 1024 * 1024
      ? `${(source.file_size / 1024).toFixed(0)} KB`
      : `${(source.file_size / 1024 / 1024).toFixed(1)} MB`
    : null

  const createdAt = source.created_at
    ? new Date(source.created_at).toLocaleDateString()
    : null

  return (
    <div
      style={s.card}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <span style={s.icon}><FileIcon name={source.file_name} /></span>

      <div style={s.main}>
        <div style={s.name}>{source.file_name || source.url || 'Unnamed source'}</div>
        <div style={s.meta}>
          {[size, createdAt, source.progress_message].filter(Boolean).join(' · ')}
        </div>
        {isProcessing && (
          <div style={s.progress}>
            <div style={{ ...s.progressFill, width: `${progress}%` }} />
          </div>
        )}
      </div>

      <div style={s.status}>
        <StatusIcon size={12} style={{ color: meta.color, flexShrink: 0 }} />
        <span style={{ color: meta.color }}>{meta.label}</span>
        {isProcessing && <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>{progress}%</span>}
      </div>

      <div style={s.actions}>
        {source.status === 'plan_ready' && onReviewPlan && (
          <button
            style={{ ...s.btn, color: 'var(--warning)', borderColor: 'rgba(255,184,0,0.3)' }}
            onClick={() => onReviewPlan(source)}
          >
            Review plan
          </button>
        )}
        {source.status === 'error' && onRetry && (
          <button
            style={{ ...s.btn, display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => onRetry(source.id)}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            <RotateCcw size={11} /> Retry
          </button>
        )}
        {onDelete && source.status !== 'processing' && (
          <button
            style={{ ...s.btn, color: 'var(--error)', borderColor: 'var(--error-soft)', padding: '3px 6px' }}
            onClick={() => onDelete(source.id)}
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </div>
  )
}
